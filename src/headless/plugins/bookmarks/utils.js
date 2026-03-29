import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';

const { u } = converse.env;

/**
 * @returns {import('shared/types').StorageKeys}
 */
export function getStorageKeys() {
    const { session } = _converse;
    const storage_key = `converse.room-bookmarks.${session.get('bare_jid')}`;
    const fetched_flag_key = `${storage_key}-fetched`;
    return { storage_key, fetched_flag_key };
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
        .catch(/** @param {Error} e */ (e) => log.fatal(e));
    return true;
}


Object.assign(u, {
    bookmarks: {
        getStorageKeys,
    }
});
