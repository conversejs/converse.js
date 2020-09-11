import { html } from "lit-html";
import { __ } from '../i18n';


const bookmark_item = (o) => {
    const info_remove_bookmark = __('Unbookmark this groupchat');
    const open_title = __('Click to open this groupchat');
    return html`
        <div class="list-item controlbox-padded room-item available-chatroom d-flex flex-row ${ (o.is_hidden(o.bm)) ? 'hidden' : ''}" data-room-jid="${o.bm.get('jid')}">
            <a class="list-item-link open-room w-100" data-room-jid="${o.bm.get('jid')}"
            title="${open_title}"
            @click=${o.openRoom}>${o.bm.getDisplayName()}</a>

            <a class="list-item-action remove-bookmark fa fa-bookmark align-self-center ${ o.bm.get('bookmarked') ? 'button-on' : '' }"
            data-room-jid="${o.bm.get('jid')}"
            data-bookmark-name="${o.bm.getDisplayName()}"
            title="${info_remove_bookmark}"
            @click=${o.removeBookmark}></a>
        </div>
    `;
}

export default (o) => {
    const desc_bookmarks = __('Click to toggle the bookmarks list');
    const label_bookmarks = __('Bookmarks');
    return html`
        <div class="list-container list-container--bookmarks ${ !o.hidden && 'hidden' || '' }">
            <a class="list-toggle bookmarks-toggle controlbox-padded"
            title="${desc_bookmarks}"
            @click=${o.toggleBookmarksList}>

                <span class="fa ${(o.toggle_state === o._converse.OPENED) ? 'fa-caret-down' : 'fa-caret-right' }">
                </span> ${label_bookmarks}</a>
            <div class="items-list bookmarks rooms-list ${ (o.toggle_state !== o._converse.OPENED) ? 'hidden' : '' }">
            ${ o.bookmarks.map(bm => bookmark_item(Object.assign({bm}, o))) }
            </div>
        </div>
    `;
}
