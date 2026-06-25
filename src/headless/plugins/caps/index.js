/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import CapsInfoCache from './collection.js';
import {
    addCapsNode,
    detectCapsOptimizationSupport,
    onDiscoEntityInfoReceived,
    onDiscoEntityInfoRequested,
    onParsePresence,
} from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('CAPS', 'http://jabber.org/protocol/caps');
Strophe.addNamespace('CAPS_OPTIMIZE', 'http://jabber.org/protocol/caps#optimize');

converse.plugins.add('converse-caps', {
    dependencies: ['converse-disco', 'converse-status'],

    initialize() {
        api.promises.add('capsInitialized');

        // Advertise XEP-0115 support in our own disco#info (XEP-0115 § 7).
        api.listen.on('addClientFeatures', () => api.disco.own.features.add(Strophe.NS.CAPS));

        // Opt in to XEP-0115 § 8.4 optimization for general presence, but
        // addCapsNode only actually optimizes broadcast presence (no `to`);
        // directed presence (probes, RAI, subscriptions) and MUC presence are
        // always annotated.
        api.listen.on('constructedPresence', (_, p) => addCapsNode(p, true));
        api.listen.on('constructedMUCPresence', (_, p) => addCapsNode(p));

        // In-memory map of full JID -> advertised caps ({ hash, node, ver }),
        // populated from incoming presence. It's connection state, so it's
        // recreated on (re)connect and cleared when the session ends.
        api.listen.on('pluginsInitialized', () => Object.assign(_converse.state, { caps_map: new Map() }));
        api.listen.on('parsePresence', onParsePresence);

        // On session end, forget the per-resource caps and the send-side
        // optimization state, so the first presence of the next session
        // re-advertises our `<c/>` (XEP-0115 § 8.4).
        const onSessionEnd = () => {
            /** @type {Map<string, unknown>} */ (_converse.state.caps_map)?.clear();
            Object.assign(_converse.state, { caps_last_sent_ver: null, caps_optimize: false });
        };
        api.listen.on('will-reconnect', onSessionEnd);
        api.listen.on('clearSession', onSessionEnd);

        // Persistent cache of verified capabilities (ver -> disco#info). Unlike
        // the map above, the cached data survives reconnects, the session ending
        // and page reloads (its store is content-addressed by verification hash).
        // A fresh collection is created on each login so it binds to the current
        // session's storage backend; the persisted entries are then re-read.
        api.listen.on('connected', () => {
            Object.assign(_converse.state, { caps_cache: new CapsInfoCache(), caps_last_sent_ver: null });
            // Detect Caps Optimization support once per connection (§ 8.4).
            detectCapsOptimizationSupport();
        });

        // Disco integration (XEP-0115 §§ 5-6). disco fires these generic hooks;
        // we answer with cached caps to avoid a query, and verify+cache real
        // responses.
        api.listen.on('discoEntityInfoRequested', onDiscoEntityInfoRequested);
        api.listen.on('discoEntityInfoReceived', onDiscoEntityInfoReceived);
    },
});
