/**
 * Reject an incoming message by replying with an error message of type "cancel".
 * @param {Element} stanza
 * @param {string} text
 * @return void
 */
export function rejectMessage(stanza: Element, text: string): void;
/**
 * Send out a XEP-0333 chat marker
 * @param {string} to_jid
 * @param {string} id - The id of the message being marked
 * @param {import("./types").MessageMarkerType} type - The marker type
 * @param {string} [msg_type]
 * @return void
 */
export function sendMarker(to_jid: string, id: string, type: import("./types").MessageMarkerType, msg_type?: string): void;
/**
 * @param {string} to_jid
 * @param {string} id
 * @return void
 */
export function sendReceiptStanza(to_jid: string, id: string): void;
/**
 * Sends a message with the given XEP-0085 chat state.
 * @param {string} jid
 * @param {import("./types").ChatStateType} chat_state
 */
export function sendChatState(jid: string, chat_state: import("./types").ChatStateType): void;
/**
 * Sends a message stanza to retract a message in this chat
 * @param {string} jid
 * @param {import('../shared/message').default} message - The message which we're retracting.
 * @param {string} retraction_id - Unique ID for the retraction message
 */
export function sendRetractionMessage(jid: string, message: import("../shared/message").default, retraction_id: string): any;
//# sourceMappingURL=actions.d.ts.map