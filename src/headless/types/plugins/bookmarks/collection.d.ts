export default Bookmarks;
export type MUC = import('../muc/muc.js').default;
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
    sendBookmarkStanza(): any;
    onBookmarkError(iq: any, options: any): void;
    fetchBookmarksFromServer(deferred: any): void;
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
    createBookmarksFromStanza(stanza: Element): void;
    onBookmarksReceived(deferred: any, iq: any): any;
    onBookmarksReceivedError(deferred: any, iq: any): any;
    getUnopenedBookmarks(): Promise<any>;
}
import { Collection } from "@converse/skeletor";
import Bookmark from "./model.js";
//# sourceMappingURL=collection.d.ts.map