/**
 * Whether a serialized extension string is the XEP-0469 `<pinned/>` element.
 * Parses and compares the element's local name and namespace, so it's robust to
 * attribute order, whitespace, quoting and namespace-prefix differences — and
 * isn't fooled by e.g. `<pinnedfoo/>` or a nested `<pinned/>` inside another
 * extension. Unparseable strings are treated as "not pinned" (and preserved).
 * @param {string} e
 * @returns {boolean}
 */
export function isPinnedExtension(e: string): boolean;
/**
 * @returns {import('shared/types').StorageKeys}
 */
export function getStorageKeys(): import("shared/types").StorageKeys;
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