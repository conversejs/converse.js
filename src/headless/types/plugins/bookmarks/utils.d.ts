export function initBookmarks(): Promise<void>;
/**
 * @param {string} jid - The JID of the bookmark.
 * @returns {string|null} The nickname if found, otherwise null.
 */
export function getNicknameFromBookmark(jid: string): string | null;
/**
 * @param {import('../chat/message')} message
 * @returns {true}
 */
export function handleBookmarksPush(message: typeof import("../chat/message")): true;
//# sourceMappingURL=utils.d.ts.map