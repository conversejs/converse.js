import log from '../log';
import { Strophe, $msg } from 'strophe.js/src/strophe';
import { _converse, api, converse } from '@converse/headless/core';

const u = converse.env.utils;

export function rejectMessage (stanza, text) {
    // Reject an incoming message by replying with an error message of type "cancel".
    api.send(
        $msg({
            'to': stanza.getAttribute('from'),
            'type': 'error',
            'id': stanza.getAttribute('id')
        })
            .c('error', { 'type': 'cancel' })
            .c('not-allowed', { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' })
            .up()
            .c('text', { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' })
            .t(text)
    );
    log.warn(`Rejecting message stanza with the following reason: ${text}`);
    log.warn(stanza);
}


/**
 * Send out a XEP-0333 chat marker
 * @param { String } to_jid
 * @param { String } id - The id of the message being marked
 * @param { String } type - The marker type
 * @param { String } msg_type
 */
export function sendMarker (to_jid, id, type, msg_type) {
    const stanza = $msg({
        'from': _converse.connection.jid,
        'id': u.getUniqueId(),
        'to': to_jid,
        'type': msg_type ? msg_type : 'chat'
    }).c(type, {'xmlns': Strophe.NS.MARKERS, 'id': id});
    api.send(stanza);
}
