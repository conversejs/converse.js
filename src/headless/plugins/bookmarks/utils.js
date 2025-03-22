import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from "@converse/log";
import Bookmarks from './collection.js';

export async function initBookmarks() {
    if (!api.settings.get('allow_bookmarks')) {
        return;
    }
    if (await Bookmarks.checkBookmarksSupport()) {
        _converse.state.bookmarks = new _converse.exports.Bookmarks();
        Object.assign(_converse, { bookmarks: _converse.state.bookmarks }); // TODO: DEPRECATED
    }
}

/**
 * @param {string} jid - The JID of the bookmark.
 * @returns {string|null} The nickname if found, otherwise null.
 */
export function getNicknameFromBookmark(jid) {
    if (!api.settings.get('allow_bookmarks')) {
        return null;
    }
    return _converse.state.bookmarks?.get(jid)?.get('nick');
}

/**
 * @param {import('../chat/message')} message
 * @returns {true}
 */
export function handleBookmarksPush(message) {
    api.waitUntil('bookmarksInitialized')
        .then(() => _converse.state.bookmarks.setBookmarksFromStanza(message))
        .catch(/** @param {Error} e */(e) => log.fatal(e));
    return true;
}
