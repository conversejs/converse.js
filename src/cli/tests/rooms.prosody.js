/**
 * Setting rooms up from the command line, on a real Prosody: the room specs
 * in the config directory, and creating a room that a join finds missing.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MUC_DOMAIN } from '../../../tests/prosody/server.js';
import { registerAccount, startDaemon } from '../../daemon/tests/real-server.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const newRoom = (name) => `${name}-${crypto.randomUUID().slice(0, 8)}@${MUC_DOMAIN}`;

describe('converse rooms on a real Prosody', () => {
    let owner, member;

    /**
     * Writes a room's spec where the CLI looks for it.
     * @param {string} room
     * @param {Record<string, any>} spec
     */
    const writeSpec = async (room, spec) => {
        const dir = path.join(owner.env.XDG_CONFIG_HOME, 'converse', 'rooms');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, `${room}.json`), JSON.stringify(spec));
    };

    /** @param {string} room */
    const settingsOf = async (room) => {
        const { code, stdout, stderr } = await run(owner.env, 'rooms', 'config', 'show', room, '--json');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        return JSON.parse(stdout);
    };

    beforeAll(async () => {
        const [owner_account, member_account] = await Promise.all([registerAccount('owner'), registerAccount('tab')]);
        owner = await startDaemon(owner_account, { access: 'full' });
        member = member_account;
    });

    afterAll(async () => {
        await owner?.stop();
    });

    it("creates a room as its spec says, when given no file", async () => {
        const room = newRoom('agents');
        await writeSpec(room, {
            settings: { membersonly: true, whois: 'anyone', persistentroom: true },
            affiliations: { member: [member.jid] },
        });
        const { code, stdout, stderr } = await run(owner.env, 'rooms', 'create', room, '--nick', 'jc');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toBe(`Created ${room}, and joined it as "jc".\nMade ${member.jid} member.\n`);

        const config = await settingsOf(room);
        expect(config.settings).toMatchObject({ membersonly: true, whois: 'anyone', persistentroom: true });
        expect(config.affiliations.member).toEqual([member.jid]);
    });

    it('makes a room match its spec, saying what it would change on a dry run first', async () => {
        const room = newRoom('drift');
        expect((await run(owner.env, 'rooms', 'create', room, '--nick', 'jc')).code).toBe(EXIT.OK);
        await writeSpec(room, { settings: { persistentroom: true, membersonly: true } });

        const dry = await run(owner.env, 'rooms', 'config', 'set', room, '--dry-run');
        expect({ code: dry.code, stderr: dry.stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(dry.stdout).toContain('Would change membersonly: false to true.');
        expect((await settingsOf(room)).settings.membersonly).toBe(false);

        const set = await run(owner.env, 'rooms', 'config', 'set', room);
        expect(set.stdout).toContain('Changed membersonly: false to true.');
        expect((await settingsOf(room)).settings).toMatchObject({ persistentroom: true, membersonly: true });

        expect((await run(owner.env, 'rooms', 'config', 'set', room)).stdout).toBe(`Nothing to change in ${room}.\n`);
    });

    it('refuses config set with nothing to set, and names where the spec would be', async () => {
        const room = newRoom('nospec');
        const { code, stderr } = await run(owner.env, 'rooms', 'config', 'set', room);
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain(path.join(owner.env.XDG_CONFIG_HOME, 'converse', 'rooms', `${room}.json`));
    });

    it("doesn't create a room a join finds missing, without a terminal to ask at", async () => {
        const room = newRoom('missing');
        const { code, stderr } = await run(owner.env, 'rooms', 'join', room);
        expect(code).toBe(EXIT.NOT_FOUND);
        expect(stderr).toContain('converse rooms create');
    });

    it('creates a room a join finds missing with --create, from its spec if it has one', async () => {
        const room = newRoom('joined');
        await writeSpec(room, { settings: { membersonly: true } });
        const { code, stdout, stderr } = await run(owner.env, 'rooms', 'join', room, '--create', '--nick', 'jc');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toBe(`Created ${room}, and joined it as "jc".\n`);
        expect((await settingsOf(room)).settings.membersonly).toBe(true);
    });
});
