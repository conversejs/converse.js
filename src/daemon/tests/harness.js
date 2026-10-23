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
import { createAccount, JID } from './account.js';

const { Strophe, stx, u } = converse.env;

export { JID };

/**
 * Starts a daemon in this process for a fresh account, and answers its roster
 * request with the given contacts.
 * @param {Object} [options]
 * @param {{ jid: string, name?: string, subscription?: string }[]} [options.roster]
 */
export async function startDaemon({ roster = [] } = {}) {
    const { env, remove } = await createAccount();
    const config = loadConfig(env);
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

    return {
        api,
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
        /** The running daemon. A spec that restarts it puts the new one here. */
        daemon,
        async stop() {
            await this.daemon.stop();
            await remove();
        },
    };
}
