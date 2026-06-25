/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import CapsInfoCache from './collection.js';
import { addCapsNode, onDiscoEntityInfoReceived, onDiscoEntityInfoRequested, onParsePresence } from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('CAPS', 'http://jabber.org/protocol/caps');

converse.plugins.add('converse-caps', {
    dependencies: ['converse-disco', 'converse-status'],

    initialize() {
        api.promises.add('capsInitialized');

        api.listen.on('constructedPresence', (_, p) => addCapsNode(p));
        api.listen.on('constructedMUCPresence', (_, p) => addCapsNode(p));

        // In-memory map of full JID -> advertised caps ({ hash, node, ver }),
        // populated from incoming presence. It's connection state, so it's
        // recreated on (re)connect and cleared when the session ends.
        api.listen.on('pluginsInitialized', () => Object.assign(_converse.state, { caps_map: new Map() }));
        api.listen.on('parsePresence', onParsePresence);

        const clearCapsMap = () => /** @type {Map<string, unknown>} */ (_converse.state.caps_map)?.clear();
        api.listen.on('will-reconnect', clearCapsMap);
        api.listen.on('clearSession', clearCapsMap);

        // Persistent cache of verified capabilities (ver -> disco#info). Unlike
        // the map above, the cached data survives reconnects, the session ending
        // and page reloads (its store is content-addressed by verification hash).
        // A fresh collection is created on each login so it binds to the current
        // session's storage backend; the persisted entries are then re-read.
        api.listen.on('connected', () => Object.assign(_converse.state, { caps_cache: new CapsInfoCache() }));

        // Disco integration (XEP-0115 §§ 5-6). disco fires these generic hooks;
        // we answer with cached caps to avoid a query, and verify+cache real
        // responses.
        api.listen.on('discoEntityInfoRequested', onDiscoEntityInfoRequested);
        api.listen.on('discoEntityInfoReceived', onDiscoEntityInfoReceived);
    },
});
