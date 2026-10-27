import { _converse, api, converse } from '@converse/headless';
import { __ } from 'i18n';

/**
 * Tells the user that the server didn't return their bookmarks in time.
 * @param {Error & {code?: string}} e
 */
export function alertBookmarksFetchError(e) {
    if (e.code !== 'bookmarks-timeout') return;
    api.alert('error', __('Timeout Error'), [
        __(
            'The server did not return your bookmarks within the allowed time. ' +
                'You can reload the page to request them again.',
        ),
    ]);
}

/**
 * @param {Event} ev
 */
export async function removeBookmarkViaEvent(ev) {
    ev.preventDefault();
    const el = /** @type {Element} */ (ev.currentTarget);
    const name = el.getAttribute('data-bookmark-name');
    const jid = el.getAttribute('data-room-jid');
    const result = await api.confirm(__('Are you sure you want to remove the bookmark "%1$s"?', name));
    if (result) {
        _converse.state.bookmarks
            .where({ jid })
            .forEach(/** @param {import('@converse/headless').Bookmark} b */ (b) => b.destroy());
    }
}

/**
 * @param {Event} ev
 */
export function openRoomViaEvent(ev) {
    ev.preventDefault();
    const { Strophe } = converse.env;
    const el = /** @type {Element} */ (ev.currentTarget);
    const name = el.textContent;
    const jid = el.getAttribute('data-room-jid');
    const data = {
        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid,
    };
    api.trigger('openConversation', { view: 'room', jid, attrs: data });
}
