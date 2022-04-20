/**
 * @module converse-carbons
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Implements support for XEP-0280 Message Carbons
 */

import log from '@converse/headless/log.js';
import { Strophe } from 'strophe.js/src/strophe';
import { _converse, api, converse } from "../core.js";

const { u } = converse.env;


/**
 * Ask the XMPP server to enable Message Carbons
 * See [XEP-0280](https://xmpp.org/extensions/xep-0280.html#enabling)
 */
async function enableCarbons (reconnecting) {
    if (reconnecting && _converse.session.get('carbons_enabled')) {
        if (_converse.session.get('smacks_enabled')) {
            // No need to re-enable carbons when resuming a XEP-0198 stream
            return;
        }
        _converse.session.set({'carbons_enabled': false})
    }

    if (!api.settings.get("message_carbons") || _converse.session?.get('carbons_enabled')) {
        return;
    }

    const iq = new Strophe.Builder('iq', {
        'from': _converse.connection.jid,
        'type': 'set'
      }).c('enable', {xmlns: Strophe.NS.CARBONS});

    const result = await api.sendIQ(iq, null, false);
    if (result === null) {
        log.warn(`A timeout occurred while trying to enable carbons`);
    } else if (u.isErrorStanza(result)) {
        log.warn('An error occurred while trying to enable message carbons.');
        log.error(result);
    } else {
        _converse.session.set({'carbons_enabled': true});
        log.debug('Message carbons have been enabled.');
    }
    _converse.session.save(); // Gather multiple sets into one save
}


converse.plugins.add('converse-carbons', {

    initialize () {
        api.settings.extend({
            message_carbons: true
        });

        api.listen.on('connected', () => enableCarbons());
        api.listen.on('reconnected', () => enableCarbons(true));
    }
});
