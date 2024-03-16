import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from "../../log.js";

const { Strophe, sizzle } = converse.env;

export async function checkBookmarksSupport () {
    const bare_jid = _converse.session.get('bare_jid');
    if (!bare_jid) return false;

    const identity = await api.disco.getIdentity('pubsub', 'pep', bare_jid);
    if (api.settings.get('allow_public_bookmarks')) {
        return !!identity;
    } else {
        return api.disco.supports(Strophe.NS.PUBSUB + '#publish-options', bare_jid);
    }
}

export async function initBookmarks () {
    if (!api.settings.get('allow_bookmarks')) {
        return;
    }
    if (await checkBookmarksSupport()) {
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
