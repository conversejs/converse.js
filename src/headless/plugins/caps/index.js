/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { addCapsNode, onParsePresence } from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('CAPS', 'http://jabber.org/protocol/caps');

converse.plugins.add('converse-caps', {
    dependencies: ['converse-status'],

    initialize() {
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
    },
});
