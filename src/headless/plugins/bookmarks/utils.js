import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from "../../log.js";
import Bookmarks from './collection.js';

const { Strophe, sizzle } = converse.env;

export async function initBookmarks () {
    if (!api.settings.get('allow_bookmarks')) {
        return;
    }
    if (await Bookmarks.checkBookmarksSupport()) {
        _converse.state.bookmarks = new _converse.exports.Bookmarks();
        Object.assign(_converse, { bookmarks: _converse.state.bookmarks }); // TODO: DEPRECATED
    }
}

export function getNicknameFromBookmark (jid) {
    if (!api.settings.get('allow_bookmarks')) {
        return null;
    }
    return _converse.state.bookmarks?.get(jid)?.get('nick');
}

export function handleBookmarksPush (message) {
    if (sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"] items[node="${Strophe.NS.BOOKMARKS}"]`, message).length) {
        api.waitUntil('bookmarksInitialized')
            .then(() => _converse.state.bookmarks.createBookmarksFromStanza(message))
            .catch(e => log.fatal(e));
    }
    return true;
}
