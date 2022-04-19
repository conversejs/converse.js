import log from "@converse/headless/log.js";
import { _converse, api, converse } from '@converse/headless/core.js';

const { Strophe, sizzle } = converse.env;

export async function checkBookmarksSupport () {
    const identity = await api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid);
    if (api.settings.get('allow_public_bookmarks')) {
        return !!identity;
    } else {
        return api.disco.supports(Strophe.NS.PUBSUB + '#publish-options', _converse.bare_jid);
    }
}

export async function initBookmarks () {
    if (!api.settings.get('allow_bookmarks')) {
        return;
    }
    if (await checkBookmarksSupport()) {
        _converse.bookmarks = new _converse.Bookmarks();
    }
}

export function getNicknameFromBookmark (jid) {
    if (!api.settings.get('allow_bookmarks')) {
        return null;
    }
    return _converse.bookmarks?.get(jid)?.get('nick');
}

export function handleBookmarksPush (message) {
    if (sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"] items[node="${Strophe.NS.BOOKMARKS}"]`, message).length) {
        api.waitUntil('bookmarksInitialized')
            .then(() => _converse.bookmarks.createBookmarksFromStanza(message))
            .catch(e => log.fatal(e));
    }
    return true;
}
