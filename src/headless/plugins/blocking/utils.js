import log from '@converse/headless/log.js';
import { _converse, api, converse } from "@converse/headless/core.js";
import { __ } from 'i18n';

const { Strophe, $iq, sizzle, u } = converse.env;

/**
 * Handle incoming iq stanzas in the BLOCKING namespace. Adjusts the global blocking._blocked.set.
 * @method handleBlockingStanza
 * @param { Object } [stanza] - The incoming stanza to handle
 */
function handleBlockingStanza ( stanza ) {
    const action = stanza.firstElementChild.tagName;
    const items = sizzle('item', stanza).map(item => item.getAttribute('jid'));
    const msg_type = stanza.getAttribute('type');

    log.debug(`handle blocking stanza Type ${msg_type} action ${action}`);
    if (msg_type == 'result' && action == 'blocklist' ) {
        log.debug(`resetting blocklist: ${items}`);
        _converse.blocking._blocked.set({'set': new Set()});
        items.forEach((item) => { _converse.blocking._blocked.get('set').add(item)});

        /**
        * Triggered once the _converse.blocking._blocked list has been fetched
        * @event _converse#blockListFetched
        * @example _converse.api.listen.on('blockListFetched', () => { ... });
        */
        api.trigger('blockListFetched', _converse.blocking._blocked.get('set'));
        log.debug("triggered blockListFetched");

    } else if (msg_type == 'set' && action == 'block') {
        log.debug(`adding people to blocklist: ${items}`);
        items.forEach((item) => { _converse.blocking._blocked.get('set').add(item)});
        api.trigger('blockListUpdated', _converse.blocking._blocked.get('set'));
    } else if (msg_type == 'set' && action == 'unblock') {
        log.debug(`removing people from blocklist: ${items}`);
        items.forEach((item) => { _converse.blocking._blocked.get('set').delete(item)});
        api.trigger('blockListUpdated', _converse.blocking._blocked.get('set'));
    } else {
        log.error("Received a blocklist push update but could not interpret it");
    }
    return true;
}

export function onConnected () {
    _converse.connection.addHandler(
        handleBlockingStanza, Strophe.NS.BLOCKING, 'iq', ['set', 'result']
    );
    api.blocking.refresh();
}

/**
 * Send block/unblock IQ stanzas to the server for the JID specified
 * @method api.sendBlockingStanza
 * @param { String } action - "block", "unblock" or "blocklist"
 * @param { String } iq_type - "get" or "set"
 * @param { Array } [jid_list] - (optional) The list of JIDs to block or unblock
 */
export async function sendBlockingStanza ( action, iq_type = 'set', jid_list = [] ) {
    if (!_converse.connection) {
        return false;
    }

    const element = Strophe.xmlElement(action, {'xmlns': Strophe.NS.BLOCKING});
    jid_list.forEach((jid) => {
        const item = Strophe.xmlElement('item', { 'jid': jid });
        element.append(item);
    });

    const iq = $iq({
            'type': iq_type,
            'id': u.getUniqueId(action)
        }).cnode(element);

    const result = await api.sendIQ(iq).catch(e => { log.fatal(e); return false });
    const err_msg = `An error occured while trying to ${action} user(s) ${jid_list}`;
    if (result === null) {
        api.alert('error', __('Error'), err_msg);
        log(err_msg, Strophe.LogLevel.WARN);
        return false;
    } else if (u.isErrorStanza(result)) {
        log.error(err_msg);
        log.error(result);
        return false;
    }
    return true;
}
