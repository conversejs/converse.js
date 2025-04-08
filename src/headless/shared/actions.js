import log from "@converse/log";
import { Strophe } from "strophe.js";
import api from "./api/index.js";
import converse from "./api/public.js";
import {CHAT_STATES, MARKER_TYPES} from "./constants.js";

const { u, stx, Stanza } = converse.env;

/**
 * Reject an incoming message by replying with an error message of type "cancel".
 * @param {Element} stanza
 * @param {string} text
 * @return void
 */
export function rejectMessage(stanza, text) {
    api.send(
        stx`<message to="${stanza.getAttribute("from")}"
                    type="error"
                    id="${stanza.getAttribute("id")}"
                    xmlns="jabber:client">
                <error type="cancel">
                    <not-allowed xmlns="${Strophe.NS.STANZAS}"/>
                    <text xmlns="${Strophe.NS.STANZAS}">${text}</text>
                </error>
            </message>`
    );
    log.warn(`Rejecting message stanza with the following reason: ${text}`);
    log.warn(stanza);
}

/**
 * Send out a XEP-0333 chat marker
 * @param {string} to_jid
 * @param {string} id - The id of the message being marked
 * @param {import("./types").MessageMarkerType} type - The marker type
 * @param {string} [msg_type]
 * @return void
 */
export function sendMarker(to_jid, id, type, msg_type) {
    if (!MARKER_TYPES.includes(type)) {
        log.error(`Invalid marker type: ${type}`);
        return;
    }
    const stanza = stx`
        <message from="${api.connection.get().jid}"
                id="${u.getUniqueId()}"
                to="${to_jid}"
                type="${msg_type ? msg_type : "chat"}"
                xmlns="jabber:client">
            <${Stanza.unsafeXML(type)} xmlns="${Strophe.NS.MARKERS}" id="${id}"/>
        </message>`;
    api.send(stanza);
}

/**
 * @param {string} to_jid
 * @param {string} id
 * @return void
 */
export function sendReceiptStanza(to_jid, id) {
    const receipt_stanza = stx`
        <message from="${api.connection.get().jid}"
                id="${u.getUniqueId()}"
                to="${to_jid}"
                type="chat"
                xmlns="jabber:client">
            <received xmlns="${Strophe.NS.RECEIPTS}" id="${id}"/>
            <store xmlns="${Strophe.NS.HINTS}"/>
        </message>`;
    api.send(receipt_stanza);
}

/**
 * Sends a message with the given XEP-0085 chat state.
 * @param {string} jid
 * @param {import("./types").ChatStateType} chat_state
 */
export function sendChatState(jid, chat_state) {
    if (api.settings.get("send_chat_state_notifications") && chat_state) {
        const allowed = api.settings.get("send_chat_state_notifications");
        if (Array.isArray(allowed) && !allowed.includes(chat_state)) {
            return;
        }
        if (!CHAT_STATES.includes(chat_state)) {
            log.error(`Invalid chat state: ${chat_state}`);
            return;
        }
        api.send(
            stx`<message id="${u.getUniqueId()}" to="${jid}" type="chat" xmlns="jabber:client">
                <${Stanza.unsafeXML(chat_state)} xmlns="${Strophe.NS.CHATSTATES}"/>
                <no-store xmlns="${Strophe.NS.HINTS}"/>
                <no-permanent-store xmlns="${Strophe.NS.HINTS}"/>
            </message>`
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
    const origin_id = message.get("origin_id");
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
