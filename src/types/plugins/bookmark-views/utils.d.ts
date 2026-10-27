/**
 * Tells the user that the server didn't return their bookmarks in time.
 * @param {Error & {code?: string}} e
 */
export function alertBookmarksFetchError(e: Error & {
    code?: string;
}): void;
/**
 * @param {Event} ev
 */
export function removeBookmarkViaEvent(ev: Event): Promise<void>;
/**
 * @param {Event} ev
 */
export function openRoomViaEvent(ev: Event): void;
//# sourceMappingURL=utils.d.ts.map