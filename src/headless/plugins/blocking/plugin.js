/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Adds support for XEP-0191 Blocking Command
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import Blocklist from './collection.js';
import BlockedEntity from './model.js';

const { Strophe } = converse.env;

Strophe.addNamespace('BLOCKING', "urn:xmpp:blocking");

converse.plugins.add('converse-blocking', {
    dependencies: ["converse-disco"],

    initialize () {
        const exports  = { Blocklist, BlockedEntity };
        Object.assign(_converse.exports, exports);

        api.listen.on('discoInitialized',  () => {
            _converse.state.blocklist = new _converse.exports.Blocklist();
        });
    }
});
