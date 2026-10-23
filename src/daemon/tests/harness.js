/**
 * Boots `@converse/headless` under Node on its MockConnection, the same mock
 * the browser suites use, so that daemon specs can drive a logged-in session
 * without a server: stanzas sent out are captured on the connection, and
 * incoming traffic is simulated with `receive`.
 *
 * Headless is a singleton per module instance, so a spec file can boot it once.
 * Vitest gives each spec file its own module graph.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { converse } from '@converse/headless';

const { Strophe, stx, u } = converse.env;

export const JID = 'romeo@montague.lit/orchard';

/**
 * Initializes headless, logs in as {@link JID} and answers the roster
 * request with the given contacts. Resolves once the roster has been fetched,
 * which is when chats can be opened.
 * @param {Object} [options]
 * @param {{ jid: string, name?: string, subscription?: string }[]} [options.roster]
 * @param {Object} [options.settings] - Overrides for `converse.initialize`.
 */
export async function login({ roster = [], settings = {} } = {}) {
    const storage_path = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-daemon-test-'));

    const _converse = await converse.initialize({
        // This BOSH URL is what makes headless pick its MockConnection (see
        // `isTestEnv`). BOSH itself is disabled under Node, so the transport
        // the mock stands in for is the websocket.
        bosh_service_url: 'montague.lit/http-bind',
        websocket_url: 'ws://montague.lit/xmpp-websocket',
        discover_connection_methods: false,
        enable_smacks: false,
        loglevel: 'error',
        storage_path,
        ...settings,
    });
    const { api } = _converse;
    await api.user.login(JID, 'secret');

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
        connection,
        receive,
        async logout() {
            await api.user.logout();
            await fs.rm(storage_path, { recursive: true, force: true });
        },
    };
}
