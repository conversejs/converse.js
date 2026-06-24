/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';

const { Strophe, u, stx } = converse.env;

export default {
    /**
     * The XEP-0092 Software Version API
     *
     * This API lets you query an XMPP entity (such as your own server) for the
     * name, version and operating system of the software it's running.
     *
     * @namespace api.version
     * @memberOf api
     */
    version: {
        /**
         * Queries an XMPP entity for its software version, as specified in
         * XEP-0092: Software Version.
         *
         * @method api.version.get
         * @param {string} [jid] The JID of the entity to query. If not provided,
         *  the user's own server (the domain part of their JID) is queried.
         * @param {number} [timeout] The amount of time in milliseconds to wait
         *  for a response.
         * @returns {Promise<import('./types').SoftwareVersion|null>} A promise
         *  which resolves with the software version details, or with `null` if
         *  the entity didn't respond or doesn't support XEP-0092.
         * @example
         * const version = await api.version.get();
         * // { name: 'Prosody', version: '0.12.0', os: 'Debian GNU/Linux' }
         */
        async get(jid, timeout) {
            if (!api.connection.authenticated()) {
                return null;
            }

            const bare_jid = _converse.session.get('bare_jid');
            jid = jid || Strophe.getDomainFromJid(bare_jid);

            const iq = stx`
                <iq type="get" to="${jid}" xmlns="jabber:client">
                    <query xmlns="${Strophe.NS.VERSION}"></query>
                </iq>`;

            const result = await api.sendIQ(iq, timeout, false);
            if (result === null || u.isErrorStanza(result)) {
                return null;
            }

            const query = result.querySelector(':scope > query');
            if (!query) {
                return null;
            }

            return {
                name: query.querySelector(':scope > name')?.textContent || null,
                version: query.querySelector(':scope > version')?.textContent || null,
                os: query.querySelector(':scope > os')?.textContent || null,
            };
        },
    },
};
