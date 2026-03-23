/**
 * Parse reactions from a message stanza and return updated attributes.
 *
 * Per XEP-0444, a reaction stanza references an existing message via
 * `<reactions id="...">`. This parser extracts the referenced message ID
 * and creates a reactions object keyed by the reacting JID (since each
 * incoming reaction stanza only contains reactions from a single JID).
 *
 * The reactions object uses JIDs as keys and arrays of emoji strings as
 * values: `{ [jid]: [emoji1, emoji2, ...] }`.
 *
 * Later, when the message attributes are applied to the original message,
 * the `getUpdatedMessageAttributes` hook merges this single-JID object
 * with existing reactions from other JIDs.
 *
 * @param {Element} stanza - The XMPP message stanza
 * @param {MessageAttributes|MUCMessageAttributes} attrs - Current message attributes
 * @returns {Promise<import('./types').MessageAttrsWithReactions|import('./types').MUCMessageAttrsWithReactions>}
 */
export function parseReactionsMessage(stanza: Element, attrs: MessageAttributes | MUCMessageAttributes): Promise<import("./types").MessageAttrsWithReactions | import("./types").MUCMessageAttrsWithReactions>;
export type MessageAttributes = import("../../shared/types").MessageAttributes;
export type MUCMessageAttributes = import("../../plugins/muc/types").MUCMessageAttributes;
//# sourceMappingURL=parsers.d.ts.map