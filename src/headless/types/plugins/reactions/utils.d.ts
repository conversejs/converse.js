/**
 * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('../../plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 * @typedef {import('./types').MessageAttrsWithReactions} MessageAttrsWithReactions
 * @typedef {import('./types').MUCMessageAttrsWithReactions} MUCMessageAttrsWithReactions
 * @typedef {import('../../shared/types').ChatBoxOrMUC} ChatBoxOrMUC
 * @typedef {import('../../shared/message').default} BaseMessage
 */
/**
 * Hook handler for the `getDuplicateMessageQueries` hook.
 *
 * Adds query objects so that incoming reaction stanzas can be matched against
 * the message they target. Per XEP-0444, the `<reactions id="...">` attribute
 * contains the id of the original message. Different clients use different id
 * types for this reference:
 *
 * - The sender's client-assigned stanza id (`msgid` / `origin_id`).
 * - The MUC-assigned stanza_id (`stanza_id <muc-jid>`), as used by Conversations
 *   and other compliant clients.
 *
 * By contributing all three query objects here we ensure a single O(n) scan
 * in {@link getDuplicateMessage} covers all cases, with no reaction-specific
 * logic leaking into shared code.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @param {object[]} queries
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} attrs
 * @returns {object[]}
 */
export function getDuplicateMessageQueries(chatbox: ChatBoxOrMUC, queries: object[], attrs: MessageAttrsWithReactions | MUCMessageAttrsWithReactions): object[];
/**
 * This hook handler merges the incoming single-reactor reactions
 * with all existing reactions from other reactors, so that no
 * reactions are lost when the message is saved. Keys are
 * occupant_id, bare JID, or full JID depending on the context
 * (see {@link parseReactionsMessage} for the priority chain).
 *
 * @param {BaseMessage} message
 * @param {MessageAttributes|MUCMessageAttributes} new_attrs
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} original_attrs
 * @returns {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} - Updated attributes
 */
export function getUpdatedMessageAttributes(message: BaseMessage, new_attrs: MessageAttributes | MUCMessageAttributes, original_attrs: MessageAttrsWithReactions | MUCMessageAttrsWithReactions): MessageAttrsWithReactions | MUCMessageAttrsWithReactions;
/**
 * Handler for the getErrorAttributesForMessage hook.
 *
 * When a reaction fails to send (e.g., due to a server error or stanza timeout),
 * this hook ensures that the user's own reaction is not preserved locally as if
 * it had been delivered successfully.
 *
 * It removes the current user's reaction from the message's reactions map,
 * so that the UI will not show a local-only reaction that failed to reach
 * the recipient.
 *
 * @param {BaseMessage} message
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} new_attrs
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} original_attrs
 * @returns {MessageAttrsWithReactions|MUCMessageAttrsWithReactions}
 */
export function getErrorAttributesForMessage(message: BaseMessage, new_attrs: MessageAttrsWithReactions | MUCMessageAttrsWithReactions, original_attrs: MessageAttrsWithReactions | MUCMessageAttrsWithReactions): MessageAttrsWithReactions | MUCMessageAttrsWithReactions;
/**
 * Handler for the beforeMessageCreated hook.
 *
 * When a reaction stanza arrives for a message that isn't in local
 * state yet (e.g. during MAM catch-up where messages arrive out of
 * order), store it as a dangling reaction so it can be applied once
 * the original message arrives.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @param {MessageAttrsWithReactions|MUCMessageAttrsWithReactions} attrs
 * @param {{handled: boolean}} data - The hook data object
 * @returns {{handled: boolean}} - Updated hook data
 */
export function onBeforeMessageCreated(chatbox: ChatBoxOrMUC, attrs: MessageAttrsWithReactions | MUCMessageAttrsWithReactions, data: {
    handled: boolean;
}): {
    handled: boolean;
};
/**
 * Handler for the afterMessageCreated hook.
 *
 * When a new message is created, check whether any dangling reactions
 * were waiting for it. If so, merge their reactions onto the new
 * message and destroy the placeholders.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @param {BaseMessage} message - The newly created message model
 */
export function onAfterMessageCreated(chatbox: ChatBoxOrMUC, message: BaseMessage): Promise<void>;
/**
 * Returns the key under which the current user's reactions are stored
 * on a given message's `reactions` map.
 *
 * The key follows the same priority chain used when parsing incoming
 * reaction stanzas ({@link parseReactionsMessage}):
 *
 * 1. **occupant_id** (XEP-0421) — stable across nick changes, works in all
 *    MUC anonymity modes.
 * 2. **real bare JID** — used only when the MUC is non-anonymous (every
 *    participant can see real JIDs), to avoid inconsistency in semi-anonymous
 *    rooms where only moderators see real JIDs.
 * 3. **full JID** (`room@domain/nick`) — last-resort fallback.
 *
 * For 1:1 chats the key is always the own bare JID.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @returns {string}
 */
export function getOwnReactionJID(chatbox: ChatBoxOrMUC): string;
export type MessageAttributes = import("../../shared/types").MessageAttributes;
export type MUCMessageAttributes = import("../../plugins/muc/types").MUCMessageAttributes;
export type MessageAttrsWithReactions = import("./types").MessageAttrsWithReactions;
export type MUCMessageAttrsWithReactions = import("./types").MUCMessageAttrsWithReactions;
export type ChatBoxOrMUC = import("../../shared/types").ChatBoxOrMUC;
export type BaseMessage = import("../../shared/message").default;
//# sourceMappingURL=utils.d.ts.map