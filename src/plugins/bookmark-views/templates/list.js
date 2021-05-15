import bookmark_item from './item.js';
import { __ } from 'i18n';
import { _converse } from '@converse/headless/core.js';
import { html } from "lit";

export default (o) => {
    const is_collapsed = _converse.bookmarks.getUnopenedBookmarks().length ? true : false;
    const desc_bookmarks = __('Click to toggle the bookmarks list');
    const label_bookmarks = __('Bookmarks');
    return html`
        <div class="list-container list-container--bookmarks ${ !is_collapsed && 'hidden' || '' }">
            <a class="list-toggle bookmarks-toggle controlbox-padded"
               title="${desc_bookmarks}"
               @click=${o.toggleBookmarksList}>

                <span class="fa ${(o.toggle_state === _converse.OPENED) ? 'fa-caret-down' : 'fa-caret-right' }">
                </span> ${label_bookmarks}</a>
            <div class="items-list bookmarks rooms-list ${ (o.toggle_state !== _converse.OPENED) ? 'hidden' : '' }">
            ${ _converse.bookmarks.map(bm => bookmark_item(Object.assign({bm}, o))) }
            </div>
        </div>
    `;
}
