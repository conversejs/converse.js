import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import sizzle from 'sizzle';

const { Strophe, stx } = converse.env;

export default {
    /**
     * BOB (Bits of Binary) API
     * @namespace _converse.api.bob
     * @memberOf _converse.api
     */
    bob: {
        /**
         * Check if CID is cached
         * @param {string} cid
         * @returns {Promise<boolean>}
         */
        async has(cid) {
            await api.waitUntil('BOBsInitialized');
            const bobs = _converse.state.bobs;
            if (!bobs) return false;
            const bob = bobs.get(cid);
            if (!bob) return false;
            return !bob.isExpired();
        },

        /**
         * Store BOB data in persistent cache
         * @param {string} cid
         * @param {string} data - Base64 encoded data
         * @param {string} type - MIME type
         * @param {number} [max_age=86400] - Max age in seconds
         */
        async store(cid, data, type, max_age = 86400) {
            await api.waitUntil('BOBsInitialized');
            const bobs = _converse.state.bobs;

            if (bobs.get(cid)) {
                return;
            }

            try {
                const size = atob(data).length;
                if (size > api.settings.get('max_bob_size')) {
                    log.warn(`BOB data for ${cid} exceeds max size (${size} > ${api.settings.get('max_bob_size')})`);
                    return;
                }
            } catch {
                log.warn(`Invalid base64 data for BOB ${cid}`);
                return;
            }

            if (!type.startsWith('image/')) {
                log.warn(`BOB data for ${cid} has unsupported MIME type: ${type}`);
                return;
            }

            bobs.create({
                cid,
                data,
                type,
                max_age,
                timestamp: Date.now(),
            });
        },

        /**
         * Get BOB data as Blob URL
         * @param {string} cid
         * @param {string} [from_jid] - JID to request from if not cached
         * @returns {Promise<string|null>} - Blob URL or null
         */
        async get(cid, from_jid) {
            await api.waitUntil('BOBsInitialized');
            const bobs = _converse.state.bobs;

            if (await this.has(cid)) {
                const bob = bobs.get(cid);
                return bob.getBlobURL();
            }

            if (from_jid) {
                try {
                    await this.fetch(cid, from_jid);
                } catch (e) {
                    log.error(`Failed to fetch BOB data for ${cid}:`, e);
                    return null;
                }
                return this.get(cid);
            }

            return null;
        },

        /**
         * Fetch BOB data via IQ-get
         * @param {string} cid
         * @param {string} from_jid
         * @returns {Promise<void>}
         */
        async fetch(cid, from_jid) {
            const iq = stx`<iq type="get" to="${from_jid}" xmlns="jabber:client">
                <data xmlns="${Strophe.NS.BOB}" cid="${cid}"/>
            </iq>`;

            const result = await api.sendIQ(iq);
            const selector = `data[xmlns="${Strophe.NS.BOB}"]`;
            const data_el = result.querySelector?.(selector) || sizzle(selector, result)[0];

            if (!data_el) {
                log.error('No BOB data in response stanza:', result);
                throw new Error('No BOB data in response');
            }

            const data = data_el.textContent.trim();
            const type = data_el.getAttribute('type');
            const max_age = parseInt(data_el.getAttribute('max-age') || '86400', 10);

            this.store(cid, data, type, max_age);
        },
    },
};
