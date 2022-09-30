import bookmark_item from './item.js';
import { __ } from 'i18n';
import { _converse } from '@converse/headless/core.js';
import { html } from "lit";

const filterBookmark = (b, text) => b.get('name')?.includes(text) || b.get('jid')?.includes(text);

export default (el) => {
    const i18n_placeholder = __('Filter');
    const filter_text = el.model.get('filter_text');
    const { bookmarks } = _converse;
    const shown_bookmarks = filter_text ? bookmarks.filter(b => filterBookmark(b, filter_text)) : bookmarks;

    return html`
        <form class="converse-form bookmarks-filter">
            <div class="btn-group w-100">
                <input
                    .value=${filter_text ?? ''}
                    @keydown="${ev => el.liveFilter(ev)}"
                    class="form-control"
                    placeholder="${i18n_placeholder}"/>

                <converse-icon size="1em" class="fa fa-times clear-input ${ !filter_text ? 'hidden' : '' }"
                    @click=${el.clearFilter}>
                </converse-icon>
            </div>
        </form>

        <div class="list-container list-container--bookmarks">
            <div class="items-list bookmarks rooms-list">
                ${ shown_bookmarks.map(bm => bookmark_item(bm)) }
            </div>
        </div>
    `;
}
