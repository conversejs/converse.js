export default Bookmarks;
declare namespace Bookmarks {
    export { Bookmark as model };
    export function comparator(item: any): any;
    export function initialize(): Promise<void>;
    export function openBookmarkedRoom(bookmark: any): Promise<any>;
    export function fetchBookmarks(): any;
    export function createBookmark(options: any): void;
    export function sendBookmarkStanza(): Promise<any>;
    export function onBookmarkError(iq: any, options: any): void;
    export function fetchBookmarksFromServer(deferred: any): void;
    export function markRoomAsBookmarked(bookmark: any): void;
    export function markRoomAsUnbookmarked(bookmark: any): void;
    export function createBookmarksFromStanza(stanza: any): void;
    export function onBookmarksReceived(deferred: any, iq: any): any;
    export function onBookmarksReceivedError(deferred: any, iq: any): any;
    export function getUnopenedBookmarks(): Promise<any>;
}
import Bookmark from "./model.js";
