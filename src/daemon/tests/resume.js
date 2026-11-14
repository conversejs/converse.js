import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { _converse, api, converse } from '@converse/headless';
import { start } from '../daemon.js';
import { serve } from './fake-server.js';
import { JID, startDaemon } from './harness.js';

const { ROOMSTATUS } = converse;
const { Strophe, stx, u } = converse.env;

const GARDEN = 'garden@conference.montague.lit';
const JULIET = 'juliet@capulet.lit';

describe('A daemon that starts while the server is out of reach', () => {
    let daemon, client, connection_proto;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet' }],
            rooms: [{ jid: GARDEN, nick: 'agent' }],
        });
        connection_proto = Object.getPrototypeOf(daemon.connection);
        await daemon.enterRoom(GARDEN, 'agent');
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${GARDEN}/juliet" to="${JID}" type="groupchat" id="${u.getUniqueId()}">
                <body>Meet me in the garden</body>
            </message>`);
        const garden = await api.rooms.get(GARDEN);
        await u.waitUntil(() => garden.messages.findWhere({ body: 'Meet me in the garden' }));
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        client?.close();
        await daemon?.stop();
    });

    /**
     * Starts the daemon again, with no way to reach the server.
     * @returns {Promise<() => void>} Brings the server back.
     */
    async function restartOffline() {
        // The attempt goes nowhere, as if the network were down.
        const connect = vi.spyOn(connection_proto, 'connect').mockImplementation(function (_jid, _password, callback) {
            this.connect_callback = callback ?? this.onConnectStatusChanged;
        });
        client?.close();
        // Headless may reuse the connection object, with what the last run sent.
        api.connection.get()?.sent_stanzas.splice(0);
        daemon.daemon = await start(daemon.config);
        client = await daemon.connect({ access: 'full' });
        return () => {
            connect.mockRestore();
            api.connection.retry();
        };
    }

    it('resumes the session it had, for clients to read, and catches up once connected', async () => {
        // The daemon is killed, without logging out or leaving its rooms.
        vi.spyOn(api.user, 'logout').mockResolvedValue(undefined);
        await daemon.daemon.stop();
        vi.mocked(api.user.logout).mockRestore();

        const join = vi.spyOn(_converse.exports.MUC.prototype, 'join');
        const goOnline = await restartOffline();
        const connection = api.connection.get();

        const { contacts } = await client.request('contacts.list');
        expect(contacts.map((c) => c.jid)).toContain(JULIET);
        const { messages } = await client.request('messages.list', { conversation: GARDEN });
        expect(messages.map((m) => m.body)).toContain('Meet me in the garden');
        const garden = await api.rooms.get(GARDEN);
        expect(garden.session.get('connection_status')).toBe(ROOMSTATUS.OFFLINE);
        expect(connection.sent_stanzas.length).toBe(0);
        // Not tried before connecting, which would time out on a long outage.
        expect(join).not.toHaveBeenCalled();
        join.mockRestore();

        goOnline();
        const receive = (stanza) => {
            const wrapper = new Strophe.Builder('wrapper').tree();
            wrapper.appendChild(stanza instanceof Element ? stanza : stanza.tree());
            connection._dataRecv(wrapper);
        };
        await u.waitUntil(() => api.connection.authenticated());
        serve({ connection, receive, jid: JID });

        // The room is rejoined by headless, once.
        const joins = () =>
            connection.sent_stanzas.filter(
                (s) =>
                    s.nodeName === 'presence' && s.getAttribute('to') === `${GARDEN}/agent` && !s.getAttribute('type'),
            );
        await u.waitUntil(() => joins().length === 1);
        receive(stx`
            <presence xmlns="jabber:client" from="${GARDEN}/agent" to="${JID}">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="member" role="participant" jid="${JID}"/>
                    <status code="110"/>
                </x>
            </presence>`);
        await u.waitUntil(() => garden.isEntered());
        expect(await api.rooms.get(GARDEN)).toBe(garden);
        expect(joins().length).toBe(1);
    });

    it('resumes it after being stopped, since stopping it is not logging out', async () => {
        await daemon.daemon.stop();
        const trigger = vi.spyOn(api, 'trigger');
        await restartOffline();
        expect(trigger.mock.calls.filter(([name]) => name === 'loadSessionCache').length).toBe(1);
        trigger.mockRestore();
    });

    it('does not resume it once it has been logged out', async () => {
        await api.user.logout();
        await daemon.daemon.stop();
        const trigger = vi.spyOn(api, 'trigger');
        await restartOffline();
        expect(trigger.mock.calls.filter(([name]) => name === 'loadSessionCache').length).toBe(0);
        expect(_converse.state.chatboxes.get(GARDEN)?.session?.get('connection_status')).not.toBe(ROOMSTATUS.ENTERED);
        trigger.mockRestore();
    });
});
