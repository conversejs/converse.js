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
     * @param {import('@converse/skeletor').FetchOrCreateOptions} [options]
     */
    setBookmark(attrs: import("./types").BookmarkAttrs, create?: boolean, options?: import("@converse/skeletor").FetchOrCreateOptions): Promise<void>;
    /**
     * @param {Bookmark} bookmark
     * @returns {Promise<void|Element>}
     */
    removeBookmarkStanza(bookmark: Bookmark): Promise<void | Element>;
    /**
     * @param {'urn:xmpp:bookmarks:1'|'storage:bookmarks'} node
     * @param {Bookmark} bookmark
     * @returns {Stanza|Stanza[]}
     */
    getPublishedItems(node: "urn:xmpp:bookmarks:1" | "storage:bookmarks", bookmark: Bookmark): Stanza | Stanza[];
    /**
     * @param {Bookmark} bookmark
     * @returns {Promise<void|Element>}
     */
    sendBookmarkStanza(bookmark: Bookmark): Promise<void | Element>;
    /**
     * @param {Element} iq
     */
    onBookmarkError(iq: Element): void;
    /**
     * @param {Promise} deferred
     */
    fetchBookmarksFromServer(deferred: Promise<any>): Promise<void>;
    /**
     * @param {Bookmark} bookmark
     */
    markRoomAsBookmarked(bookmark: Bookmark): void;
    /**
     * @param {Bookmark} bookmark
     */
    onAutoJoinChanged(bookmark: Bookmark): void;
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
}
import Bookmark from './model.js';
import { Collection } from '@converse/skeletor';
import { Stanza } from 'strophe.js';
//# sourceMappingURL=collection.d.ts.map