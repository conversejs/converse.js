import log from "@converse/log";
import { Strophe, $msg } from 'strophe.js';
import api from './api/index.js';
import converse from './api/public.js';

const { u, stx } = converse.env;

/**
 * Reject an incoming message by replying with an error message of type "cancel".
 * @param {Element} stanza
 * @param {string} text
 * @return void
 */
export function rejectMessage(stanza, text) {
    api.send(
        $msg({
            'to': stanza.getAttribute('from'),
            'type': 'error',
            'id': stanza.getAttribute('id'),
        })
            .c('error', { 'type': 'cancel' })
            .c('not-allowed', { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' }).up()
            .c('text', { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' }).t(text)
    );
    log.warn(`Rejecting message stanza with the following reason: ${text}`);
    log.warn(stanza);
}

/**
 * Send out a XEP-0333 chat marker
 * @param {string} to_jid
 * @param {string} id - The id of the message being marked
 * @param {string} type - The marker type
 * @param {string} [msg_type]
 * @return void
 */
export function sendMarker(to_jid, id, type, msg_type) {
    const stanza = $msg({
        'from': api.connection.get().jid,
        'id': u.getUniqueId(),
        'to': to_jid,
        'type': msg_type ? msg_type : 'chat',
    }).c(type, { 'xmlns': Strophe.NS.MARKERS, 'id': id });
    api.send(stanza);
}

/**
 * @param {string} to_jid
 * @param {string} id
 * @return void
 */
export function sendReceiptStanza(to_jid, id) {
    const receipt_stanza = $msg({
        'from': api.connection.get().jid,
        'id': u.getUniqueId(),
        'to': to_jid,
        'type': 'chat',
    })
        .c('received', { 'xmlns': Strophe.NS.RECEIPTS, 'id': id }).up()
        .c('store', { 'xmlns': Strophe.NS.HINTS }).up();
    api.send(receipt_stanza);
}

/**
 * Sends a message with the given XEP-0085 chat state.
 * @param {string} jid
 * @param {string} chat_state
 */
export function sendChatState(jid, chat_state) {
    if (api.settings.get('send_chat_state_notifications') && chat_state) {
        const allowed = api.settings.get('send_chat_state_notifications');
        if (Array.isArray(allowed) && !allowed.includes(chat_state)) {
            return;
        }
        api.send(
            $msg({
                'id': u.getUniqueId(),
                'to': jid,
                'type': 'chat',
            })
                .c(chat_state, { 'xmlns': Strophe.NS.CHATSTATES }).up()
                .c('no-store', { 'xmlns': Strophe.NS.HINTS }).up()
                .c('no-permanent-store', { 'xmlns': Strophe.NS.HINTS })
        );
    }
}

/**
 * Sends a message stanza to retract a message in this chat
 * @param {string} jid
 * @param {import('../shared/message').default} message - The message which we're retracting.
 * @param {string} retraction_id - Unique ID for the retraction message
 */
export function sendRetractionMessage(jid, message, retraction_id) {
    const origin_id = message.get('origin_id');
    if (!origin_id) {
        throw new Error("Can't retract message without a XEP-0359 Origin ID");
    }
    const stanza = stx`
        <message id="${retraction_id}"
                 to="${jid}"
                 type="chat"
                 xmlns="jabber:client">
            <retract id="${origin_id}" xmlns="${Strophe.NS.RETRACT}"/>
            <body>/me retracted a message</body>
            <store xmlns="${Strophe.NS.HINTS}"/>
            <fallback xmlns="${Strophe.NS.FALLBACK}" for="${Strophe.NS.RETRACT}" />
        </message>`;
    return api.connection.get().send(stanza);
}
