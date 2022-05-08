import { __ } from 'i18n';
import { _converse } from '@converse/headless/core';
import { html } from "lit";

const tpls_headlines_feeds_list_item = (el, feed) => {
    const open_title = __('Click to open this server message');
    return html`
        <div class="list-item controlbox-padded d-flex flex-row"
            data-headline-jid="${feed.get('jid')}">
        <a class="list-item-link open-headline available-room w-100"
            data-headline-jid="${feed.get('jid')}"
            title="${open_title}"
            @click=${ev => el.openHeadline(ev)}
            href="#">${feed.get('jid')}</a>
        </div>
    `;
}

export default (el) => {
    const feeds = el.model.filter(m => m.get('type') === _converse.HEADLINES_TYPE);
    const heading_headline  = __('Announcements');
    return html`
        <div class="controlbox-section" id="headline">
            <div class="d-flex controlbox-padded ${ feeds.length ? '' : 'hidden' }">
                <span class="w-100 controlbox-heading controlbox-heading--headline">${heading_headline}</span>
            </div>
        </div>
        <div class="list-container list-container--headline ${ feeds.length ? '' : 'hidden' }">
            <div class="items-list rooms-list headline-list">
                ${ feeds.map(feed => tpls_headlines_feeds_list_item(el, feed)) }
            </div>
        </div>`
}
