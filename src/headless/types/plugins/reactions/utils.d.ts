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
 * @param {import('../../plugins/muc/muc.js').default | import('../../plugins/chat/model.js').default} chatbox
 * @returns {string}
 */
export function getOwnReactionJID(chatbox: import("../../plugins/muc/muc.js").default | import("../../plugins/chat/model.js").default): string;
/**
 * Publish the given list of unicode emojis as the user's popular reactions
 * to their private PEP node (XEP-0223).
 *
 * @param {string[]} emojis - Unicode emoji strings to store
 */
export function publishPopularReactions(emojis: string[]): Promise<void>;
/**
 * On connect/reconnect, fetch the user's stored popular reactions from
 * their private PEP node and register a push handler so that updates
 * from other devices are applied immediately.
 * @param {import('./popular-model.js').default} popular_reactions - The model tracking frequencies
 */
export function onConnected(popular_reactions: import("./popular-model.js").default): Promise<void>;
//# sourceMappingURL=utils.d.ts.map