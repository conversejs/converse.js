/**
 * @module converse-carbons
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Implements support for XEP-0280 Message Carbons
 */

import log from '@converse/headless/log';
import { Strophe } from 'strophe.js/src/strophe';
import { _converse, api, converse } from "../core.js";


/* Ask the XMPP server to enable Message Carbons
 * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
 */
function enableCarbons (reconnecting) {
    if (reconnecting) {
        _converse.session?.set({'carbons_enabled': false})
    }
    if (!api.settings.get("message_carbons") || _converse.session?.get('carbons_enabled')) {
        return;
    }
    const carbons_iq = new Strophe.Builder('iq', {
        'from': _converse.connection.jid,
        'id': 'enablecarbons',
        'type': 'set'
      })
      .c('enable', {xmlns: Strophe.NS.CARBONS});

    _converse.connection.addHandler((iq) => {
        if (iq.querySelectorAll('error').length > 0) {
            log.warn('An error occurred while trying to enable message carbons.');
        } else {
            _converse.session.set({'carbons_enabled': true});
            log.debug('Message carbons have been enabled.');
        }
        _converse.session.save(); // Gather multiple sets into one save
    }, null, "iq", null, "enablecarbons");
    _converse.connection.send(carbons_iq);
}


converse.plugins.add('converse-carbons', {

    initialize () {
        api.settings.extend({
            message_carbons: true
        });

        api.listen.on('afterResourceBinding', enableCarbons);
    }
});
