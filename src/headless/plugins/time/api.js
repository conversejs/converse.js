import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';

const { Strophe, stx, u } = converse.env;

export default {
    /**
     * The "time" namespace groups methods for XEP-0202 Entity Time
     * @namespace api.time
     * @memberOf api
     */
    time: {
        /**
         * Gets the entity time from a JID per XEP-0202
         * @method api.time.get
         * @param {string} jid - The JID to query for time
         * @param {number} [timeout=10000] - Timeout in milliseconds
         * @returns {Promise<{utc: Date, tzo: string}|null>} The entity's time info or null on error
         */
        async get(jid, timeout = 10000) {
            if (!api.connection.authenticated()) {
                log.debug('Not querying time when not authenticated');
                return null;
            }

            const iq = stx`
                <iq type="get" to="${jid}" id="${u.getUniqueId('time')}" xmlns="jabber:client">
                    <time xmlns="${Strophe.NS.TIME}"/>
                </iq>`;

            const result = await api.sendIQ(iq, timeout, false);

            if (result === null) {
                log.warn(`Timeout while getting time from ${jid}`);
                return null;
            } else if (u.isErrorStanza(result)) {
                log.debug(`Error getting time from ${jid} (entity may not support XEP-0202)`);
                return null;
            }

            const time_el = result.querySelector('time');
            const utc_str = time_el?.querySelector('utc')?.textContent;
            const tzo = time_el?.querySelector('tzo')?.textContent;

            if (!utc_str || !tzo) {
                log.error('Invalid time response - missing utc or tzo');
                return null;
            }

            return {
                utc: new Date(utc_str),
                tzo: tzo
            };
        }
    }
};
