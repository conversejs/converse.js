import fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { converse } from '@converse/headless';
import { start } from '../daemon.js';
import { ERRORS } from '../protocol.js';
import { startDaemon } from './harness.js';

const { Strophe, stx, u } = converse.env;
const JULIET = 'juliet@capulet.lit';
const ROSTER = [{ jid: JULIET, name: 'Juliet Capulet' }];

describe('Scheduled sends', () => {
    let daemon;

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
    });

    const at = (milliseconds) => new Date(Date.now() + milliseconds).toISOString();

    const sent = () =>
        daemon.api.connection
            .get()
            .sent_stanzas.filter((s) => s.nodeName === 'message' && s.getAttribute('to') === JULIET)
            .map((s) => s.querySelector('body')?.textContent);

    async function request(method, params, access = 'restricted', consumer = 'scheduler-test') {
        const client = await daemon.connect({ access, consumer });
        try {
            return await client.request(method, params);
        } finally {
            client.close();
        }
    }

    async function answerRoster() {
        const connection = daemon.api.connection.get();
        const roster_iq = await u.waitUntil(() =>
            connection.IQ_stanzas.find((iq) => iq.querySelector('query')?.getAttribute('xmlns') === Strophe.NS.ROSTER),
        );
        const reply = stx`
            <iq xmlns="jabber:client" type="result" id="${roster_iq.getAttribute('id')}">
                <query xmlns="${Strophe.NS.ROSTER}">
                    <item jid="${JULIET}" name="Juliet Capulet" subscription="both"/>
                </query>
            </iq>`;
        const wrapper = new Strophe.Builder('wrapper').tree();
        wrapper.appendChild(reply.tree());
        connection._dataRecv(wrapper);
        await daemon.api.waitUntil('rosterContactsFetched');
    }

    it('checks policy without spending rate limit, then sends at the requested time', async () => {
        daemon = await startDaemon({
            roster: ROSTER,
            mode: 'bot',
            policy: { direct: [JULIET], rate_limit: { per_conversation: 1, overall: 1, window: 60 } },
        });
        const result = await request('schedules.create', { to: JULIET, body: 'Later', at: at(100) });

        expect(result).toMatchObject({
            outcome: 'scheduled',
            schedule: {
                id: expect.any(String),
                to: JULIET,
                body: 'Later',
                consumer: 'scheduler-test',
                access: 'restricted',
            },
        });
        expect(sent()).toEqual([]);
        await u.waitUntil(() => sent().includes('Later'));
        expect((await request('schedules.list')).schedules).toEqual([]);
    });

    it('refuses a schedule that policy does not allow, and stores nothing', async () => {
        daemon = await startDaemon({ roster: ROSTER, policy: { allow: [] } });

        expect(await request('schedules.create', { to: JULIET, body: 'No', at: at(60_000) })).toMatchObject({
            outcome: 'refused',
            rule: 'allowlist',
        });
        expect((await request('schedules.list')).schedules).toEqual([]);
    });

    it('lets a restricted consumer list and cancel only its own schedules', async () => {
        daemon = await startDaemon({ roster: ROSTER, mode: 'bot', policy: { direct: [JULIET] } });
        const { schedule } = await request('schedules.create', { to: JULIET, body: 'Maybe', at: at(60_000) });

        expect((await request('schedules.list', {}, 'restricted', 'someone-else')).schedules).toEqual([]);
        await expect(
            request('schedules.cancel', { id: schedule.id }, 'restricted', 'someone-else'),
        ).rejects.toMatchObject({ code: ERRORS.NOT_FOUND });
        expect((await request('schedules.list')).schedules).toEqual([schedule]);
        expect(await request('schedules.cancel', { id: schedule.id })).toEqual({ schedule });
        await expect(request('schedules.cancel', { id: schedule.id })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });

    it('keeps full-access schedules out of reach of restricted connections', async () => {
        daemon = await startDaemon({ roster: ROSTER });
        const { schedule } = await request('schedules.create', { to: JULIET, body: 'Maybe', at: at(60_000) }, 'full');

        expect((await request('schedules.list')).schedules).toEqual([]);
        await expect(request('schedules.cancel', { id: schedule.id })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
        expect((await request('schedules.list', {}, 'full')).schedules).toEqual([schedule]);
        expect(await request('schedules.cancel', { id: schedule.id }, 'full')).toEqual({ schedule });
    });

    it('sends an overdue persisted message when the daemon starts again', async () => {
        daemon = await startDaemon({ roster: ROSTER });
        await request('schedules.create', { to: JULIET, body: 'After restart', at: at(250) }, 'full');

        await daemon.daemon.stop();
        await new Promise((resolve) => setTimeout(resolve, 300));
        daemon.daemon = await start(daemon.config);
        await answerRoster();

        await u.waitUntil(() => sent().includes('After restart'));
        expect((await request('schedules.list')).schedules).toEqual([]);
    });

    it('parks a restricted schedule that policy refuses when it becomes due, and keeps it until cancelled', async () => {
        daemon = await startDaemon({ roster: ROSTER, mode: 'bot', policy: { direct: [JULIET] } });
        const { schedule } = await request('schedules.create', { to: JULIET, body: 'Policy changed', at: at(100) });
        daemon.config.policy.direct.length = 0;

        await vi.waitFor(async () => {
            const { schedules } = await request('schedules.list');
            expect(schedules).toEqual([
                { ...schedule, parked: expect.objectContaining({ rule: 'allowlist', at: expect.any(String) }) },
            ]);
        });
        expect(sent()).toEqual([]);
        expect(await request('schedules.cancel', { id: schedule.id })).toMatchObject({ schedule: { id: schedule.id } });
        expect((await request('schedules.list')).schedules).toEqual([]);
    });

    it('holds back a due message that a rate limit refuses, to try again later, instead of parking it', async () => {
        daemon = await startDaemon({
            roster: ROSTER,
            mode: 'bot',
            policy: { direct: [JULIET], rate_limit: { per_conversation: 1, overall: 20, window: 60 } },
        });
        // Scheduling checks the limit too, so it's spent between then and the due time.
        const { schedule } = await request('schedules.create', { to: JULIET, body: 'Too soon', at: at(500) });
        await request('messages.send', { to: JULIET, body: 'Now' });

        // The refusal at due time is audited.
        await vi.waitFor(async () => {
            const audit = (await fs.readFile(daemon.config.paths.audit, 'utf8')).trim().split('\n').map(JSON.parse);
            expect(audit.at(-1)).toMatchObject({ outcome: 'refused', rule: 'rate_conversation' });
        });
        expect((await request('schedules.list')).schedules).toEqual([schedule]);
        expect(sent()).toEqual(['Now']);
    });

    it('requires a future ISO 8601 time', async () => {
        daemon = await startDaemon({ roster: ROSTER });
        for (const value of ['tomorrow morning', new Date(Date.now() - 1).toISOString(), undefined]) {
            await expect(
                request('schedules.create', { to: JULIET, body: 'No', at: value }, 'full'),
            ).rejects.toMatchObject({
                code: ERRORS.INVALID_PARAMS,
            });
        }
    });

    it('refuses "at" on messages.send, rather than sending now what was meant for later', async () => {
        daemon = await startDaemon({ roster: ROSTER });
        await expect(
            request('messages.send', { to: JULIET, body: 'No', at: at(60_000) }, 'full'),
        ).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: '"at" is for "schedules.create", which sends it later.',
        });
        expect(sent()).toEqual([]);
    });
});
