/**
 * @typedef {import('@converse/headless').MUC} MUC
 * @typedef {import('plugins/bookmark-views/components/bookmarks-pin-list').BookmarksPinView} BookmarksPinView
 */

import { constants } from "@converse/headless";
import { __ } from "i18n";
import { html } from "lit";
import { tplRoomItem } from "shared/roomslist/templates/room-item";
import '../styles/pin-list.scss';

/**
 * @param {BookmarksPinView} el
 */
export default (el) => {
    const rooms = el.getRoomsToShow();
    const is_closed = el.model.get('toggle_state') === constants.CLOSED;

    return html`
            <div class="d-flex controlbox-padded">
                <span class="w-100 controlbox-heading controlbox-heading--groupchats">
                    <a class="list-toggle open-rooms-toggle" role="heading" aria-level="3"
                       title="${__('Click to toggle the list of pinned groupchats')}"
                       @click=${ev => el.toggleRoomsList(ev)}>
    
                        ${__('Pinned groupchats')}
    
                        ${rooms.length ? html`<converse-icon
                            class="fa ${ is_closed ? 'fa-caret-right' : 'fa-caret-down' }"
                            size="1em"
                            color="var(--muc-color)"></converse-icon>` : '' }
                    </a>
                </span>
            </div>
    
            <div class="list-container list-container--openrooms ${ rooms.length ? '' : 'hidden' }">
                <ul class="items-list rooms-list open-rooms-list ${ is_closed ? 'collapsed' : '' }">
                    ${
                        rooms.map(/** @param {MUC} room */(room) => tplRoomItem(el, room))
                    }
                </ul>
            </div>`;
}
