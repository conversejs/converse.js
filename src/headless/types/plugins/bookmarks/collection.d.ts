export default Bookmarks;
export type MUC = import("../muc/muc.js").default;
declare class Bookmarks extends Collection {
    static checkBookmarksSupport(): Promise<any>;
    constructor();
    get idAttribute(): string;
    initialize(): Promise<void>;
    fetched_flag: string;
    model: typeof Bookmark;
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
     */
    setBookmark(attrs: import("./types").BookmarkAttrs, create?: boolean): void;
    /**
     * @param {'urn:xmpp:bookmarks:1'|'storage:bookmarks'} node
     * @returns {Stanza|Stanza[]}
     */
    getPublishedItems(node: "urn:xmpp:bookmarks:1" | "storage:bookmarks"): Stanza | Stanza[];
    /**
     * @returns {Promise<void|Element>}
     */
    sendBookmarkStanza(): Promise<void | Element>;
    /**
     * @param {Element} iq
     * @param {import('./types').BookmarkAttrs} attrs
     */
    onBookmarkError(iq: Element, attrs: import("./types").BookmarkAttrs): void;
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
    getUnopenedBookmarks(): Promise<any>;
}
import { Collection } from '@converse/skeletor';
import Bookmark from './model.js';
import { Stanza } from 'strophe.js';
//# sourceMappingURL=collection.d.ts.map