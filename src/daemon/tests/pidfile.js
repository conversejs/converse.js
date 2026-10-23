import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claimPidfile, pidfileHolder } from '../pidfile.js';

const JID = 'romeo@montague.lit';
// A pid that can't be running.
const GONE = 2147483646;
// Pids that are: this process, and the one that started it.
const LIVE = [process.pid, process.ppid];

describe('The pidfile', () => {
    let dir, pidfile;

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-pidfile-'));
        pidfile = path.join(dir, 'romeo.pid');
    });

    afterEach(() => fs.rm(dir, { recursive: true, force: true }));

    const contents = () => fs.readFile(pidfile, 'utf8');
    const leftovers = async () => (await fs.readdir(dir)).filter((f) => f !== 'romeo.pid');

    it('is taken by a daemon when no one holds it', async () => {
        await claimPidfile(pidfile, { jid: JID, pid: LIVE[0] });
        expect(await contents()).toBe(`${LIVE[0]}\n`);
        expect((await fs.stat(pidfile)).mode & 0o777).toBe(0o600);
        expect(await pidfileHolder(pidfile)).toBe(LIVE[0]);
        expect(await leftovers()).toEqual([]);
    });

    it('is refused to a daemon while a running one holds it', async () => {
        await fs.writeFile(pidfile, `${LIVE[1]}\n`);
        await expect(claimPidfile(pidfile, { jid: JID, pid: LIVE[0] })).rejects.toThrow(
            `A daemon for ${JID} is already running (pid ${LIVE[1]}). Stop it with "converse-cli daemon stop".`,
        );
        expect(await contents()).toBe(`${LIVE[1]}\n`);
    });

    it('is taken over when the process it names is gone, or it names none', async () => {
        for (const stale of [`${GONE}\n`, '', 'not a pid']) {
            await fs.writeFile(pidfile, stale);
            expect(await pidfileHolder(pidfile)).toBeNull();
            await claimPidfile(pidfile, { jid: JID, pid: LIVE[0] });
            expect(await contents()).toBe(`${LIVE[0]}\n`);
            await fs.rm(pidfile);
        }
        expect(await leftovers()).toEqual([]);
    });

    it('has no holder when there is none', async () => {
        expect(await pidfileHolder(pidfile)).toBeNull();
    });

    /** Races the two live pids to claim it, and returns which one won. */
    async function race() {
        const results = await Promise.allSettled(LIVE.map((pid) => claimPidfile(pidfile, { jid: JID, pid })));
        const winners = LIVE.filter((_, i) => results[i].status === 'fulfilled');
        expect(winners).toHaveLength(1);
        const loser = /** @type {PromiseRejectedResult} */ (results.find((r) => r.status === 'rejected'));
        expect(loser.reason.message).toBe(
            `A daemon for ${JID} is already running (pid ${winners[0]}). Stop it with "converse-cli daemon stop".`,
        );
        return winners[0];
    }

    // Many rounds, so that the claims interleave differently.
    it.each([
        ['', null],
        [', over a stale one', `${GONE}\n`],
    ])('is taken by exactly one of several daemons starting at once%s', async (_, stale) => {
        for (let round = 0; round < 25; round++) {
            if (stale) await fs.writeFile(pidfile, stale);
            const winner = await race();
            expect(await contents()).toBe(`${winner}\n`);
            expect(await leftovers()).toEqual([]);
            await fs.rm(pidfile);
        }
    });
});
