export default Bookmarks;
declare class Bookmarks extends Collection {
    constructor();
    model: typeof Bookmark;
    initialize(): Promise<void>;
    fetched_flag: string;
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