/**
 * Resolves the full JID to query for a given chat.
 *
 * Their highest-priority resource is the best answer. Failing that (they're
 * offline, or we have no presence subscription), the most recent message they
 * sent us carries a full JID, which is stale but better than asking their
 * server a question only their client can answer.
 * @param {any} chatbox
 * @returns {string|null}
 */
export function getFullJIDForChat(chatbox: any): string | null;
/**
 * Schedules a (debounced) entity time query for this chat.
 * @param {any} chatbox
 */
export function fetchEntityTime(chatbox: any): void;
/**
 * Starts tracking entity time for a private chat.
 *
 * Queries are deliberately tied to the chat being open. Asking on behalf of
 * every chat restored from storage at login would put a burst of queries on the
 * wire and tell a pile of contacts we're back, for chats the user isn't looking
 * at.
 * @param {any} chatbox
 */
export function onChatBoxInitialized(chatbox: any): void;
/**
 * What we know about the contact's local time, right now.
 * @param {any} contact - A roster contact
 * @returns {import('./types').ContactTime|null}
 */
export function getContactTime(contact: any): import("./types").ContactTime | null;
//# sourceMappingURL=entity-time.d.ts.map