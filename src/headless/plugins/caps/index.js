/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, converse } from '@converse/headless/core';
import { createCapsNode } from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('CAPS', "http://jabber.org/protocol/caps");


converse.plugins.add('converse-caps', {

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        XMPPStatus: {
            constructPresence () {
                const presence = this.__super__.constructPresence.apply(this, arguments);
                presence.root().cnode(createCapsNode(_converse)).up();
                return presence;
            }
        }
    }
});
