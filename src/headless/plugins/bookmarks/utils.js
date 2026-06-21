import { Stanza } from 'strophe.js';
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';

const { Strophe, u } = converse.env;

/**
 * Whether a serialized extension string is the XEP-0469 `<pinned/>` element.
 * Parses and compares the element's local name and namespace, so it's robust to
 * attribute order, whitespace, quoting and namespace-prefix differences — and
 * isn't fooled by e.g. `<pinnedfoo/>` or a nested `<pinned/>` inside another
 * extension. Unparseable strings are treated as "not pinned" (and preserved).
 * @param {string} e
 * @returns {boolean}
 */
export function isPinnedExtension(e) {
    try {
        const el = Stanza.toElement(e);
        return el.localName === 'pinned' && el.namespaceURI === Strophe.NS.BOOKMARKS_PINNING;
    } catch {
        return false;
    }
}

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
