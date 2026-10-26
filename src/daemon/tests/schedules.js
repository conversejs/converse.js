import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
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

    async function request(method, params, access = 'restricted') {
        const client = await daemon.connect({ access, consumer: 'scheduler-test' });
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
        const result = await request('messages.send', { to: JULIET, body: 'Later', at: at(100) });

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

        expect(await request('messages.send', { to: JULIET, body: 'No', at: at(60_000) })).toMatchObject({
            outcome: 'refused',
            rule: 'allowlist',
        });
        expect((await request('schedules.list')).schedules).toEqual([]);
    });

    it('lists and cancels a persisted schedule', async () => {
        daemon = await startDaemon({ roster: ROSTER });
        const { schedule } = await request('messages.send', { to: JULIET, body: 'Maybe', at: at(60_000) }, 'full');

        expect((await request('schedules.list')).schedules).toEqual([schedule]);
        expect(await request('schedules.cancel', { id: schedule.id })).toEqual({ schedule });
        expect((await request('schedules.list')).schedules).toEqual([]);
        await expect(request('schedules.cancel', { id: schedule.id })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });

    it('sends an overdue persisted message when the daemon starts again', async () => {
        daemon = await startDaemon({ roster: ROSTER });
        await request('messages.send', { to: JULIET, body: 'After restart', at: at(250) }, 'full');

        await daemon.daemon.stop();
        await new Promise((resolve) => setTimeout(resolve, 300));
        daemon.daemon = await start(daemon.config);
        await answerRoster();

        await u.waitUntil(() => sent().includes('After restart'));
        expect((await request('schedules.list')).schedules).toEqual([]);
    });

    it('rechecks changed policy when a restricted schedule becomes due', async () => {
        daemon = await startDaemon({ roster: ROSTER, mode: 'bot', policy: { direct: [JULIET] } });
        await request('messages.send', { to: JULIET, body: 'Policy changed', at: at(100) });
        daemon.config.policy.direct.length = 0;

        await u.waitUntil(() => fs.existsSync(daemon.config.paths.audit));
        await u.waitUntil(() => {
            const entries = fs.readFileSync(daemon.config.paths.audit, 'utf8').trim().split('\n').map(JSON.parse);
            return entries.some(({ outcome, rule }) => outcome === 'refused' && rule === 'allowlist');
        });
        expect(sent()).toEqual([]);
        expect((await request('schedules.list')).schedules).toEqual([]);
    });

    it('requires a future ISO 8601 time', async () => {
        daemon = await startDaemon({ roster: ROSTER });
        for (const value of ['tomorrow morning', new Date(Date.now() - 1).toISOString()]) {
            await expect(request('messages.send', { to: JULIET, body: 'No', at: value }, 'full')).rejects.toMatchObject(
                {
                    code: ERRORS.INVALID_PARAMS,
                },
            );
        }
    });
});
