import { _converse, api, converse } from '@converse/headless/core';
const { Strophe } = converse.env;

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
        await _converse.bookmarks.fetchBookmarks();
        /**
         * Triggered once the _converse.Bookmarks collection
         * has been created and cached bookmarks have been fetched.
         * @event _converse#bookmarksInitialized
         * @example _converse.api.listen.on('bookmarksInitialized', () => { ... });
         */
        api.trigger('bookmarksInitialized');
    }
}

/**
  * Check if the user has a bookmark with a saved nickanme
  * for this groupchat and return it.
  */
export function getNicknameFromBookmark (jid) {
    if (!_converse.bookmarks || !api.settings.get('allow_bookmarks')) {
        return null;
    }
    const bookmark = _converse.bookmarks.findWhere({'jid': jid});
    if (bookmark) {
        return bookmark.get('nick');
    }
}
