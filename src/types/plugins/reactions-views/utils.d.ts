/**
 * Use the PopularReactions model if available, otherwise fall back to the setting
 * @param {string[]} allowed_emojis
 * @returns {string[]}
 */
export function getPopularReactions(allowed_emojis: string[]): string[];
/**
 * Helper function to update a message with reactions (JID-keyed format).
 * Used for optimistic updates when sending reactions.
 *
 * Reactions are stored as `{ jid: [emoji1, emoji2, ...] }`.
 * For MUC the key is the full JID (room@domain/nick), matching what the
 * server will echo back. For 1:1 chats the key is the bare JID.
 *
 * @param {BaseMessage} message - The message model to update
 * @param {string[]} emojis - The list of emojis (can be empty for removal)
 */
export function updateMessageReactions(message: BaseMessage, emojis: string[]): void;
/**
 * Send a XEP-0444 reaction stanza and optimistically update the message.
 *
 * @param {BaseMessage} message - The message model to update
 * @param {string} emoji - The selected emoji or shortname
 */
export function sendReaction(message: BaseMessage, emoji: string): void;
/**
 * Convert JID-keyed reactions to emoji-keyed format for display.
 *
 * Input:  `{ jid1: ['👍', '❤️'], jid2: ['👍'] }`
 * Output: `{ '👍': ['jid1', 'jid2'], '❤️': ['jid1'] }`
 *
 * @param {Record<string, string[]>} reactions - JID-keyed reactions map
 * @returns {Record<string, string[]>} - Emoji-keyed map for display
 */
export function getEmojiKeyedReactions(reactions: Record<string, string[]>): Record<string, string[]>;
/**
 * Resolves a list of reactor JIDs to human-readable display names.
 *
 * For MUC, the key is a full JID (room@domain/nick) — the nick is extracted
 * directly from the resource part. For 1:1 chats the key is a bare JID and
 * we look up the roster contact for the best available name.
 *
 * Returns a formatted string such as:
 *   "Alice"
 *   "Alice and Bob"
 *   "Alice, Bob and 1 other"
 *   "Alice, Bob and 3 others"
 *
 * @param {string[]} jids - Reactor JIDs (MUC full JIDs or 1:1 bare JIDs)
 * @param {ChatBoxOrMUC} chatbox - The chatbox model
 * @returns {Promise<string>}
 */
export function getReactorNames(jids: string[], chatbox: ChatBoxOrMUC): Promise<string>;
/**
 * Registers a handler for disco#info result stanzas to check for restricted reactions support.
 */
export function registerRestrictedReactionsHandler(): void;
export type BaseMessage = import("@converse/headless/types/shared/message").default;
export type ChatBoxOrMUC = import("@converse/headless/types/shared/types").ChatBoxOrMUC;
//# sourceMappingURL=utils.d.ts.map