import { __ } from 'i18n';
import { html } from "lit";
import { constants } from '@converse/headless';

const { HEADLINES_TYPE } = constants;

function tplHeadlinesFeedsListItem (el, feed) {
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
    const feeds = el.model.filter(m => m.get('type') === HEADLINES_TYPE);
    const heading_headline  = __('Announcements');
    return html`
        <div class="controlbox-section" id="headline">
            <div class="d-flex controlbox-padded ${ feeds.length ? '' : 'hidden' }">
                <span class="w-100 controlbox-heading controlbox-heading--headline"
                    role="heading" aria-level="3"
                >${heading_headline}</span>
            </div>
        </div>
        <div class="list-container list-container--headline ${ feeds.length ? '' : 'hidden' }">
            <div class="items-list rooms-list headline-list">
                ${ feeds.map(feed => tplHeadlinesFeedsListItem(el, feed)) }
            </div>
        </div>`
}
