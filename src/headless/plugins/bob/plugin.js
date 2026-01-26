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

const { Strophe, $iq } = converse.env;

// Maximum size for BOB data (8KB as per XEP-0231)
const MAX_BOB_SIZE = 8192;

// In-memory cache for BOB data
const bob_cache = new Map();

/**
 * Parse CID and validate format
 * @param {string} cid - Content-ID (e.g., "cid:sha1+abc@bob.xmpp.org")
 * @returns {Object|null} - {algo, hash, domain} or null if invalid
 */
function parseCID(cid) {
    const match = cid.match(/^cid:([^+]+)\+([^@]+)@(.+)$/);
    if (!match) return null;
    return {
        algo: match[1],
        hash: match[2],
        domain: match[3]
    };
}

/**
 * Check if cached data has expired
 * @param {Object} cached - Cached entry
 * @returns {boolean}
 */
function isExpired(cached) {
    if (!cached.maxAge) return false;
    if (cached.maxAge === 0) return true; // Ephemeral
    const age = (Date.now() - cached.timestamp) / 1000;
    return age > cached.maxAge;
}

converse.plugins.add('converse-bob', {
    dependencies: [],

    initialize() {
        const { api } = this._converse;

        // Register namespace
        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add('urn:xmpp:bob');
        });

        // Expose BOB API
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
                    const cached = bob_cache.get(cid);
                    if (!cached) return false;
                    if (isExpired(cached)) {
                        bob_cache.delete(cid);
                        return false;
                    }
                    return true;
                },

                /**
                 * Store BOB data in cache
                 * @param {string} cid
                 * @param {string} data - Base64 encoded data
                 * @param {string} type - MIME type
                 * @param {number} maxAge - Max age in seconds
                 */
                store(cid, data, type, maxAge) {
                    // Validate size
                    const size = atob(data).length;
                    if (size > MAX_BOB_SIZE) {
                        log.warn(`BOB data for ${cid} exceeds max size (${size} > ${MAX_BOB_SIZE})`);
                        return;
                    }

                    // Validate MIME type (only images for now)
                    if (!type.startsWith('image/')) {
                        log.warn(`BOB data for ${cid} has unsupported MIME type: ${type}`);
                        return;
                    }

                    bob_cache.set(cid, {
                        data,
                        type,
                        maxAge: maxAge || 86400, // Default 24 hours
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
                    // Check cache
                    if (this.has(cid)) {
                        const cached = bob_cache.get(cid);
                        const binary = atob(cached.data);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        const blob = new Blob([bytes], { type: cached.type });
                        return URL.createObjectURL(blob);
                    }

                    // If from_jid provided, request via IQ
                    if (from_jid) {
                        try {
                            await this.fetch(cid, from_jid);
                            return this.get(cid); // Recursive call after fetch
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
                    const maxAge = parseInt(data_el.getAttribute('max-age') || '86400', 10);

                    this.store(cid, data, type, maxAge);
                }
            }
        });

// Parse BOB (Bits of Binary) data from message
        api.listen.on('parseMessage', (stanza, attrs) => {
            const bob_data = [];
            const data_els = sizzle('data[xmlns="urn:xmpp:bob"]', stanza);
            
            data_els.forEach(el => {
                const cid = el.getAttribute('cid');
                const type = el.getAttribute('type');
                const maxAge = parseInt(el.getAttribute('max-age') || '86400', 10);
                const data = el.textContent.trim();
                
                if (cid && data) {
                    bob_data.push({ cid, data, type, maxAge });
                    // Auto-store in cache
                    api.bob?.store(cid, data, type, maxAge);
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
