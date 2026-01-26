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
import bob_api from './api.js';

const { Strophe } = converse.env;

Strophe.addNamespace('BOB', 'urn:xmpp:bob');

converse.plugins.add('converse-bob', {
    dependencies: [],

    initialize() {
        const { api } = this._converse;

        api.promises.add('BOBsInitialized');

        api.settings.extend({
            max_bob_size: 8192,
        });

        const exports = { BOB, BOBs };
        Object.assign(_converse.exports, exports);

        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(Strophe.NS.BOB);
            api.disco.own.features.add('http://jabber.org/protocol/xhtml-im');
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

        Object.assign(api, bob_api);

        api.listen.on('parseMessage', (stanza, attrs) => {
            const bob_data = [];
            const data_els = sizzle(`data[xmlns="${Strophe.NS.BOB}"]`, stanza);

            data_els.forEach((el) => {
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

            // Extract cid: URIs from XHTML-IM <img> tags (e.g. Pidgin custom smileys).
            // When a client sends a custom smiley, the plain <body> only contains
            // fallback text. The cid: URI is only in the XHTML-IM <img src="cid:..."/>.
            //
            // Converse extracts attrs.body from the XHTML body's textContent, which
            // drops <img> elements entirely. So we walk the XHTML body DOM to
            // reconstruct the text with cid: URIs in place of <img> elements.
            const xhtml_body = stanza.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'body')[0];
            if (xhtml_body) {
                const cid_imgs = Array.from(
                    xhtml_body.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'img')
                ).filter((img) => img.getAttribute('src')?.startsWith('cid:'));

                if (cid_imgs.length > 0) {
                    // Walk all nodes in the XHTML body and build text, replacing
                    // <img src="cid:..."> with the cid: URI string.
                    const walker = xhtml_body.ownerDocument.createTreeWalker(
                        xhtml_body,
                        4 | 1, // NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
                        null
                    );
                    const parts = [];
                    let node;
                    while ((node = walker.nextNode())) {
                        if (node.nodeType === 3) {
                            // Text node
                            parts.push(node.textContent);
                        } else if (
                            node.nodeType === 1 &&
                            node.localName === 'img' &&
                            node.getAttribute('src')?.startsWith('cid:')
                        ) {
                            parts.push(node.getAttribute('src'));
                        }
                    }
                    const body = parts.join('').trim();
                    if (body) {
                        attrs.body = body;
                        attrs.message = body;
                    }

                    // Fetch BOB data via IQ for any CIDs not included inline
                    // (e.g. Pidgin sends <img src="cid:..."> without inline <data>)
                    const from_jid = attrs.from || stanza.getAttribute('from');
                    const bare_from = Strophe.getBareJidFromJid(from_jid);
                    const stored_cids = new Set((attrs.bob_data || []).map((b) => b.cid));
                    for (const img of cid_imgs) {
                        const src = img.getAttribute('src');
                        const cid = src.slice(4); // strip "cid:" prefix
                        if (!stored_cids.has(cid)) {
                            log.info(`BOB: Fetching missing CID via IQ: ${cid}`);
                            api.bob
                                .fetch(cid, from_jid)
                                .then(() => {
                                    // Re-render messages containing this CID
                                    const chatbox = _converse.chatboxes.get(bare_from);
                                    if (chatbox) {
                                        chatbox.messages.forEach((msg) => {
                                            const body = msg.get('body') || '';
                                            if (body.includes(cid)) {
                                                // Force a real model change to trigger view re-render
                                                msg.save('bob_updated', Date.now());
                                            }
                                        });
                                    }
                                })
                                .catch((e) => log.error(`BOB: IQ fetch failed for ${cid}:`, e));
                        }
                    }
                }
            }

            return attrs;
        });

        log.info('XEP-0231: Bits of Binary plugin initialized');
    },
});
