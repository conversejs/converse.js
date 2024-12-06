export default Bookmarks;
export type MUC = import("../muc/muc.js").default;
declare class Bookmarks extends Collection {
    static checkBookmarksSupport(): Promise<any>;
    constructor();
    initialize(): Promise<void>;
    fetched_flag: string;
    model: typeof Bookmark;
    /**
     * @param {Bookmark} bookmark
     */
    openBookmarkedRoom(bookmark: Bookmark): Promise<Bookmark>;
    fetchBookmarks(): any;
    createBookmark(options: any): void;
    /**
     * @typedef {import('strophe.js').Stanza} Stanza
     * @returns {Promise<Stanza>}
     */
    getPubSubPublishNode(): Promise<import("strophe.js").Stanza>;
    sendBookmarkStanza(): Promise<any>;
    /**
     * @param {Element} iq
     * @param {{jid: string}} options
     */
    onBookmarkError(iq: Element, options: {
        jid: string;
    }): void;
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
    markRoomAsUnbookmarked(bookmark: Bookmark): void;
    /**
     * @param {Element} stanza
     */
    createBookmarksFromStanza(stanza: Element): Promise<void>;
    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    onBookmarksReceived(deferred: any, iq: Element): Promise<any>;
    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    onBookmarksReceivedError(deferred: any, iq: Element): any;
    getUnopenedBookmarks(): Promise<any>;
}
import { Collection } from '@converse/skeletor';
import Bookmark from './model.js';
//# sourceMappingURL=collection.d.ts.map