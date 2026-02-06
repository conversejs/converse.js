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

            return attrs;
        });

        log.info('XEP-0231: Bits of Binary plugin initialized');
    },
});
