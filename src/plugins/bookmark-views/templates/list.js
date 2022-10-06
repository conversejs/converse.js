import bookmark_item from './item.js';
import { __ } from 'i18n';
import { _converse } from '@converse/headless/core.js';
import { html } from "lit";
import { until } from 'lit/directives/until.js';

const list = (el, bookmarks) => {
    const desc_bookmarks = __('Click to toggle the bookmarks list');
    const label_bookmarks = __('Bookmarks');
    const toggle_state = el.model.get('toggle-state');
    return html`
        <div class="list-container list-container--bookmarks ${ bookmarks.length ? 'fade-in' : 'hidden' }">
            <a class="list-toggle bookmarks-toggle controlbox-padded"
               title="${desc_bookmarks}"
               @click=${() => el.toggleBookmarksList()}>

               <converse-icon
                   class="fa ${(toggle_state === _converse.OPENED) ? 'fa-caret-down' : 'fa-caret-right' }"
                   size="1em"
                   color="var(--muc-color)">
                </converse-icon> ${label_bookmarks}</a>
            <div class="items-list bookmarks rooms-list ${ (toggle_state === _converse.OPENED) ? 'fade-in' : 'hidden fade-out' }">
            ${ _converse.bookmarks.map(bm => bookmark_item(bm)) }
            </div>
        </div>
    `;
}

export default (el) => {
    const bookmarks = _converse.bookmarks.getUnopenedBookmarks();
    return until(bookmarks.then((bookmarks) => list(el, bookmarks)), '');
}
