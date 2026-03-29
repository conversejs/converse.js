/**
 * @typedef {import('../../plugins/muc/muc').default} MUC
 * @typedef {import('../../plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('./types').MUCMessageAttrsWithReactions} MUCMessageAttrsWithReactions
 * @typedef {import('./types').MessageAttrsWithReactions} MessageAttrsWithReactions
 */
/**
 * Parse reactions from a message stanza and return updated attributes.
 *
 * Per XEP-0444, a reaction stanza references an existing message via
 * `<reactions id="...">`. This parser extracts the referenced message ID
 * and creates a reactions object keyed by the reacting party's stable
 * identity key (since each incoming reaction stanza only contains reactions
 * from a single sender).
 *
 * The key used for the `reactions` map follows this priority chain for MUC:
 *
 * 1. **occupant_id** (XEP-0421) — stable across nick changes, works in all
 *    MUC anonymity modes.
 * 2. **real bare JID** (`from_real_jid`) — used only when the MUC is
 *    non-anonymous, to avoid key inconsistency in semi-anonymous rooms where
 *    only moderators can see real JIDs.
 * 3. **full JID** (`room@domain/nick`) — last-resort fallback.
 *
 * For 1:1 chats the key is always the sender's bare JID.
 *
 * Later, when the message attributes are applied to the original message,
 * the `getUpdatedMessageAttributes` hook merges this single-reactor object
 * with existing reactions from other reactors.
 *
 * @param {Element} stanza - The XMPP message stanza
 * @param {MessageAttributes|MUCMessageAttributes} attrs - Current message attributes
 * @param {MUC} [chatbox] - The MUC model,
 *   passed for MUC messages so we can inspect room features (e.g. anonymity mode).
 *   For 1:1 chats, this parameter is `undefined`.
 * @returns {Promise<MessageAttrsWithReactions|MUCMessageAttrsWithReactions>}
 */
export function parseReactionsMessage(stanza: Element, attrs: MessageAttributes | MUCMessageAttributes, chatbox?: MUC): Promise<MessageAttrsWithReactions | MUCMessageAttrsWithReactions>;
export type MUC = import("../../plugins/muc/muc").default;
export type MUCMessageAttributes = import("../../plugins/muc/types").MUCMessageAttributes;
export type MessageAttributes = import("../../shared/types").MessageAttributes;
export type MUCMessageAttrsWithReactions = import("./types").MUCMessageAttrsWithReactions;
export type MessageAttrsWithReactions = import("./types").MessageAttrsWithReactions;
//# sourceMappingURL=parsers.d.ts.map