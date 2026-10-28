/**
 * Runs the daemon on headless's MockConnection, the same mock the browser
 * suites use, so that specs can drive it through its socket without a server:
 * stanzas the daemon sends are captured on the connection, and incoming
 * traffic is simulated with `receive`.
 *
 * Headless is a singleton per module instance, and an in-process daemon is one
 * per spec file at a time. Vitest gives each spec file its own module graph.
 */
import { api, converse } from '@converse/headless';
import { connect } from '../client.js';
import { loadConfig } from '../config.js';
import { start } from '../daemon.js';
import { createRoomStore } from '../rooms.js';
import { createAccount, JID } from './account.js';
import { serve } from './fake-server.js';

const { Strophe, stx, u } = converse.env;

export { JID };

/**
 * Starts a daemon in this process for a fresh account, answers its roster
 * request with the given contacts, and plays the server for disco and MAM
 * (see fake-server.js).
 * @param {Object} [options]
 * @param {{ jid: string, name?: string, subscription?: string }[]} [options.roster]
 * @param {string[]} [options.server_features]
 * @param {Parameters<typeof serve>[0]['archive']} [options.archive]
 * @param {Record<string, unknown>} [options.settings] - More headless settings
 * @param {Parameters<typeof serve>[0]['mam_mode']} [options.mam_mode]
 * @param {boolean} [options.fulltext] - Whether the archive offers full-text search. Defaults to true.
 * @param {Parameters<typeof serve>[0]['upload_service']} [options.upload_service] - An XEP-0363 service
 * @param {Partial<import('../types').Policy>} [options.policy] - The send policy, from the config file
 * @param {import('../types').Mode} [options.mode] - How the account acts, from the config file
 * @param {{ jid: string, nick: string }[]} [options.rooms] - The rooms stored from an earlier run, to rejoin
 * @param {import('../types').Access} [options.access] - The level the CLI connects at
 */
export async function startDaemon({
    roster = [],
    server_features,
    archive,
    settings,
    mam_mode,
    fulltext,
    upload_service,
    policy,
    mode,
    rooms,
    access,
    allow_unencrypted_resend,
} = {}) {
    const { env, remove } = await createAccount(settings, {
        ...(policy ? { policy } : {}),
        ...(mode ? { mode } : {}),
        ...(access ? { access } : {}),
        ...(allow_unencrypted_resend !== undefined ? { allow_unencrypted_resend } : {}),
    });
    const config = loadConfig(env);
    if (rooms) {
        const store = createRoomStore(config.paths.rooms);
        rooms.forEach(({ jid, nick }) => store.add(jid, nick));
    }
    const daemon = await start(config);
    const connection = api.connection.get();

    /**
     * Feeds a stanza into the connection as if the server had sent it.
     * @param {Element|import('strophe.js').Builder} stanza
     */
    const receive = (stanza) => {
        const wrapper = new Strophe.Builder('wrapper').tree();
        wrapper.appendChild(stanza instanceof Element ? stanza : stanza.tree());
        connection._dataRecv(wrapper);
    };

    const roster_iq = await u.waitUntil(() =>
        connection.IQ_stanzas.find((iq) => iq.querySelector('query')?.getAttribute('xmlns') === Strophe.NS.ROSTER),
    );
    receive(stx`
        <iq xmlns="jabber:client" type="result" id="${roster_iq.getAttribute('id')}" to="${JID}">
            <query xmlns="${Strophe.NS.ROSTER}">
                ${roster.map(
                    ({ jid, name = '', subscription = 'both' }) =>
                        stx`<item jid="${jid}" name="${name}" subscription="${subscription}"/>`,
                )}
            </query>
        </iq>`);
    await api.waitUntil('rosterContactsFetched');
    const server = serve({
        connection,
        receive,
        jid: JID,
        server_features,
        archive,
        mam_mode,
        fulltext,
        upload_service,
    });

    /**
     * Waits for the presence that joins a room as `nick`. The room's disco#info
     * is the fake server's to answer.
     * @param {string} room
     * @param {string} nick
     */
    const awaitJoin = (room, nick) =>
        u.waitUntil(() =>
            connection.sent_stanzas.some(
                (s) =>
                    s.nodeName === 'presence' && s.getAttribute('to') === `${room}/${nick}` && !s.getAttribute('type'),
            ),
        );

    return {
        api,
        /** The MAM queries the daemon sent, in order. */
        mam_queries: server.mam_queries,
        /** Changes how MAM queries are answered from now on. */
        setMAMMode: server.setMAMMode,
        config,
        connection,
        env,
        receive,
        /**
         * Connects a client to this daemon, without auto-spawning.
         * @param {Object} [options]
         * @param {string} [options.consumer]
         */
        connect: (options) => connect({ ...options, spawn: false, env }),
        /**
         * Lets the daemon into a room it's joining, under `nick`.
         * @param {string} room
         * @param {string} [nick]
         */
        async enterRoom(room, nick = 'claude') {
            await awaitJoin(room, nick);
            receive(stx`
                <presence xmlns="jabber:client" from="${room}/${nick}" to="${JID}">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="member" role="participant" jid="${JID}"/>
                        <status code="110"/>
                    </x>
                </presence>`);
            const model = await api.rooms.get(room);
            await u.waitUntil(() => model.isEntered());
        },
        /**
         * Turns down the daemon's join of a room, as one it's banned from.
         * @param {string} room
         * @param {string} [nick]
         */
        async refuseRoom(room, nick = 'claude') {
            await awaitJoin(room, nick);
            receive(stx`
                <presence xmlns="jabber:client" from="${room}/${nick}" to="${JID}" type="error">
                    <x xmlns="${Strophe.NS.MUC}"/>
                    <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                </presence>`);
        },
        /** The running daemon. A spec that restarts it puts the new one here. */
        daemon,
        async stop() {
            await this.daemon.stop();
            await remove();
        },
    };
}
