import { _converse, api, converse } from '@converse/headless/core';
const { Strophe } = converse.env;

export async function checkBookmarksSupport () {
    const identity = await api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid);
    if (_converse.allow_public_bookmarks) {
        return !!identity;
    } else {
        return api.disco.supports(Strophe.NS.PUBSUB + '#publish-options', _converse.bare_jid);
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
