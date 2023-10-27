import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless';
import { checkBookmarksSupport } from '@converse/headless/plugins/bookmarks/utils';
import { CHATROOMS_TYPE } from '@converse/headless/shared/constants';


export function getHeadingButtons (view, buttons) {
    if (api.settings.get('allow_bookmarks') && view.model.get('type') === CHATROOMS_TYPE) {
        const data = {
            'i18n_title': __('Bookmark this groupchat'),
            'i18n_text': __('Bookmark'),
            'handler': (ev) => view.showBookmarkModal(ev),
            'a_class': 'toggle-bookmark',
            'icon_class': 'fa-bookmark',
            'name': 'bookmark'
        };
        const names = buttons.map(t => t.name);
        const idx = names.indexOf('details');
        const data_promise = checkBookmarksSupport().then((s) => (s ? data : null));
        return idx > -1 ? [...buttons.slice(0, idx), data_promise, ...buttons.slice(idx)] : [data_promise, ...buttons];
    }
    return buttons;
}

export async function removeBookmarkViaEvent (ev) {
    ev.preventDefault();
    const name = ev.currentTarget.getAttribute('data-bookmark-name');
    const jid = ev.currentTarget.getAttribute('data-room-jid');
    const result = await api.confirm(__('Are you sure you want to remove the bookmark "%1$s"?', name));
    if (result) {
        _converse.bookmarks.where({ jid }).forEach(b => b.destroy());
    }
}

export function addBookmarkViaEvent (ev) {
    ev.preventDefault();
    const jid = ev.currentTarget.getAttribute('data-room-jid');
    api.modal.show('converse-bookmark-form-modal', { jid }, ev);
}


export function openRoomViaEvent (ev) {
    ev.preventDefault();
    const { Strophe } = converse.env;
    const name = ev.target.textContent;
    const jid = ev.target.getAttribute('data-room-jid');
    const data = {
        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
    };
    api.rooms.open(jid, data, true);
}
