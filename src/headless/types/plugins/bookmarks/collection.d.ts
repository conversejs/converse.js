export default Bookmarks;
export type MUC = import("../muc/muc.js").default;
/**
 * @extends {Collection<Bookmark>}
 */
declare class Bookmarks extends Collection<Bookmark> {
    static checkBookmarksSupport(): Promise<any>;
    constructor();
    get idAttribute(): string;
    model: typeof Bookmark;
    initialize(): Promise<void>;
    fetched_flag: string;
    /** @returns {boolean} Whether the server supports native bookmarks and their extensions. */
    supportsPinning(): boolean;
    /**
     * @param {Bookmark} bookmark
     */
    openBookmarkedRoom(bookmark: Bookmark): Promise<Bookmark>;
    fetchBookmarks(): Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    /**
     * @param {import('./types').BookmarkAttrs} attrs
     * @param {boolean} [create=true]
     * @param {import('./types').SetBookmarkOptions} [options]
     * @returns {Promise<Bookmark|undefined>}
     */
    setBookmark(attrs: import("./types").BookmarkAttrs, create?: boolean, options?: import("./types").SetBookmarkOptions): Promise<Bookmark | undefined>;
    /**
     * @param {Bookmark} bookmark
     * @returns {Promise<void|Element>}
     */
    sendRemoveBookmarkStanza(bookmark: Bookmark): Promise<void | Element>;
    /**
     * @param {'urn:xmpp:bookmarks:1'|'storage:bookmarks'} node
     * @param {Bookmark} [bookmark]
     * @returns {Stanza|Stanza[]}
     */
    getPublishedItems(node: "urn:xmpp:bookmarks:1" | "storage:bookmarks", bookmark?: Bookmark): Stanza | Stanza[];
    /**
     * @param {Bookmark} [bookmark]
     * @returns {Promise<void|Element>}
     */
    sendBookmarkStanza(bookmark?: Bookmark): Promise<void | Element>;
    /**
     * @param {Element|Error} error
     */
    onBookmarkError(error: Element | Error): void;
    /**
     * @param {Promise} deferred
     */
    fetchBookmarksFromServer(deferred: Promise<any>): Promise<void>;
    /**
     * @param {Bookmark} bookmark
     * @param {boolean} _autojoin
     * @param {{ rollback?: boolean }} [options]
     */
    onAutoJoinChanged(bookmark: Bookmark, _autojoin: boolean, options?: {
        rollback?: boolean;
    }): void;
    /**
     * @param {Bookmark} bookmark
     */
    leaveRoom(bookmark: Bookmark): Promise<void>;
    /**
     * @param {Element} stanza
     */
    setBookmarksFromStanza(stanza: Element): Promise<void>;
    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    onBookmarksReceived(deferred: any, iq: Element): Promise<any>;
    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    onBookmarksReceivedError(deferred: any, iq: Element): Promise<void>;
    getUnopenedBookmarks(): Promise<Bookmark[]>;
    /**
     * Pin a bookmark to the top of the lists (XEP-0469) by ensuring exactly one
     * `<pinned/>` element is present in its extensions. We always (re)publish,
     * even when the bookmark already looks pinned locally: the operation is
     * idempotent (any existing `<pinned/>` is stripped before re-adding a single
     * one, so it can't accumulate duplicates) and self-healing if our local
     * state and the server's have diverged. The `pinned` attribute is derived
     * from the extensions by {@link Bookmark}.
     * @param {Bookmark} bookmark
     * @returns {Promise<Bookmark|undefined>}
     */
    pinBookmark(bookmark: Bookmark): Promise<Bookmark | undefined>;
    /**
     * Pin a room to the top of the lists (XEP-0469). Pinning is an extension on
     * a bookmark, so if the room isn't bookmarked yet we bookmark it first
     * (with autojoin enabled, so the pin survives a reload) and include the
     * `<pinned/>` extension in the same publish.
     * @param {string} jid
     * @returns {Promise<Bookmark|undefined>}
     */
    pinRoom(jid: string): Promise<Bookmark | undefined>;
    /**
     * Unpin a room by its JID (XEP-0469). A no-op if the room isn't bookmarked
     * (you can only unpin something that was pinned, which requires a bookmark).
     * @param {string} jid
     * @returns {Promise<Bookmark|undefined>}
     */
    unpinRoom(jid: string): Promise<Bookmark | undefined>;
    /**
     * Unpin a bookmark (XEP-0469) by removing its `<pinned/>` extension.
     * Idempotent and self-healing for the same reasons as {@link pinBookmark}.
     * @param {Bookmark} bookmark
     * @returns {Promise<Bookmark|undefined>}
     */
    unpinBookmark(bookmark: Bookmark): Promise<Bookmark | undefined>;
    #private;
}
import Bookmark from './model.js';
import { Collection } from '@converse/skeletor';
import { Stanza } from 'strophe.js';
//# sourceMappingURL=collection.d.ts.map