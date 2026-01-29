/**
 * @module converse-bob
 * @description
 * XEP-0231: Bits of Binary
 * Handles receiving and caching small binary data (custom smileys, CAPTCHAs)
 */
import sizzle from 'sizzle';
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import log from '@converse/log';
import BOB from './bob.js';
import BOBs from './bobs.js';

const { $iq } = converse.env;

converse.plugins.add('converse-bob', {
    dependencies: [],

    initialize() {
        const { api } = this._converse;

        api.promises.add('BOBsInitialized');

        api.settings.extend({
            max_bob_size: 8192
        });

        const exports = { BOB, BOBs };
        Object.assign(_converse.exports, exports);

        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add('urn:xmpp:bob');
        });

        api.listen.on('connected', async () => {
            const bobs = new _converse.exports.BOBs();
            _converse.state.bobs = bobs;
            await bobs.initialize();

            _converse.state.bobs_cleanup_interval = setInterval(() => {
                if (_converse.state.bobs) {
                    _converse.state.bobs.cleanupExpired();
                }
            }, 600000);
        });

        api.listen.on('clearSession', () => {
            if (_converse.state.bobs_cleanup_interval) {
                clearInterval(_converse.state.bobs_cleanup_interval);
                delete _converse.state.bobs_cleanup_interval;
            }
            if (_converse.state.bobs) {
                _converse.state.bobs.clearStore();
                delete _converse.state.bobs;
            }
        });

        Object.assign(api, {
            /**
             * BOB (Bits of Binary) API
             */
            bob: {
                /**
                 * Check if CID is cached
                 * @param {string} cid
                 * @returns {boolean}
                 */
                has(cid) {
                    const bobs = _converse.state.bobs;
                    if (!bobs) return false;
                    return !!bobs.get(cid);
                },

                /**
                 * Store BOB data in persistent cache
                 * @param {string} cid
                 * @param {string} data - Base64 encoded data
                 * @param {string} type - MIME type
                 * @param {number} max_age - Max age in seconds
                 */
                store(cid, data, type, max_age) {
                    const bobs = _converse.state.bobs;
                    if (!bobs) {
                        log.warn('BOB collection not initialized');
                        return;
                    }

                    try {
                        const size = atob(data).length;
                        if (size > api.settings.get('max_bob_size')) {
                            log.warn(`BOB data for ${cid} exceeds max size (${size} > ${api.settings.get('max_bob_size')})`);
                            return;
                        }
                    } catch (e) {
                        log.warn(`Invalid base64 data for BOB ${cid}`);
                        return;
                    }

                    if (!type.startsWith('image/')) {
                        log.warn(`BOB data for ${cid} has unsupported MIME type: ${type}`);
                        return;
                    }

                    if (bobs.get(cid)) {
                        return;
                    }

                    bobs.create({
                        cid,
                        data,
                        type,
                        max_age: max_age || 86400,
                        timestamp: Date.now()
                    });
                },

                /**
                 * Get BOB data as Blob URL
                 * @param {string} cid
                 * @param {string} [from_jid] - JID to request from if not cached
                 * @returns {Promise<string|null>} - Blob URL or null
                 */
                async get(cid, from_jid) {
                    const bobs = _converse.state.bobs;

                    if (this.has(cid)) {
                        const bob = bobs.get(cid);
                        return bob.getBlobURL();
                    }

                    if (from_jid) {
                        try {
                            await this.fetch(cid, from_jid);
                            return this.get(cid);
                        } catch (e) {
                            log.error(`Failed to fetch BOB data for ${cid}:`, e);
                            return null;
                        }
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
                    const iq = $iq({
                        type: 'get',
                        to: from_jid
                    }).c('data', {
                        xmlns: 'urn:xmpp:bob',
                        cid: cid
                    });

                    const result = await api.sendIQ(iq);
                    const data_el = result.querySelector('data[xmlns="urn:xmpp:bob"]');

                    if (!data_el) {
                        throw new Error('No BOB data in response');
                    }

                    const data = data_el.textContent.trim();
                    const type = data_el.getAttribute('type');
                    const max_age = parseInt(data_el.getAttribute('max-age') || '86400', 10);

                    this.store(cid, data, type, max_age);
                }
            }
        });

        api.listen.on('parseMessage', (stanza, attrs) => {
            const bob_data = [];
            const data_els = sizzle('data[xmlns="urn:xmpp:bob"]', stanza);

            data_els.forEach(el => {
                const cid = el.getAttribute('cid');
                const type = el.getAttribute('type');
                const max_age = parseInt(el.getAttribute('max-age') || '86400', 10);
                const data = el.textContent.trim();

                if (cid && data) {
                    bob_data.push({ cid, data, type, max_age });
                    api.bob?.store(cid, data, type, max_age);
                }
            });

            if (bob_data.length > 0) {
                attrs.bob_data = bob_data;
            }

            return attrs;
        });

        log.info('XEP-0231: Bits of Binary plugin initialized');
    }
});
