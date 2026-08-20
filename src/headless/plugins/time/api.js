import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';
import { getContactTime } from './entity-time.js';
import { normalizeTZO } from './utils.js';

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
         * @returns {Promise<import('./types').EntityTime|null>} The entity's
         *  time info, or `null` if the entity didn't respond or doesn't
         *  support XEP-0202.
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

            const time_el = result.querySelector(':scope > time');
            const utc_str = time_el?.querySelector(':scope > utc')?.textContent;
            const tzo_str = time_el?.querySelector(':scope > tzo')?.textContent;

            if (!utc_str || !tzo_str) {
                log.error(`Invalid time response from ${jid} - missing utc or tzo`);
                return null;
            }

            const utc = new Date(utc_str);
            if (isNaN(utc.getTime())) {
                log.error(`Invalid time response from ${jid} - unparseable utc: ${utc_str}`);
                return null;
            }

            const tzo = normalizeTZO(tzo_str);
            if (!tzo) {
                log.error(`Invalid time response from ${jid} - unparseable tzo: ${tzo_str}`);
                return null;
            }

            return { utc, tzo };
        },

        /**
         * @namespace api.time.contact
         * @memberOf api.time
         */
        contact: {
            /**
             * What we currently know about a contact's local time. Everything a
             * UI needs in order to decide whether, and what, to show. Returns
             * `null` while their offset is still unknown.
             *
             * Reads what the last query recorded, rather than waiting for one,
             * so unlike {@link api.time.get} it answers immediately. An answer
             * old enough to have gone stale (they may have travelled, or
             * crossed a DST boundary) does start a query in the background, to
             * be reported by the contact's `entity_time:change` event. The
             * result describes this instant, so call it again whenever you
             * redraw rather than holding on to it.
             * @method api.time.contact.get
             * @param {any} contact - A roster contact
             * @returns {import('./types').ContactTime|null}
             * @example
             * const t = api.time.contact.get(chat.contact);
             * if (t?.should_warn) console.log(`It's ${t.time} for them`);
             */
            get: getContactTime,
        },
    },
};
