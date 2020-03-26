import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';


const i18n_desc_rooms = __('Click to toggle the list of open groupchats');
const i18n_add_bookmark = __('Bookmark this groupchat');
const i18n_leave_room = __('Leave this groupchat');
const i18n_remove_bookmark = __('Unbookmark this groupchat');
const i18n_title = __('Show more information on this groupchat');
const i18n_open = __('Click to open this groupchat');
// Note to translators, "Open Groupchats" refers to groupchats that are open, NOT a command.
const i18n_rooms = __('Open Groupchats');


const unread_indicator = (o) => html`<span class="list-item-badge badge badge-room-color msgs-indicator">${ o.room.get('num_unread') }</span>`;


const bookmark = (o) => {
    if (o.bookmarked) {
        return html`
            <a class="list-item-action fa fa-bookmark remove-bookmark button-on"
               data-room-jid="${o.room.get('jid')}"
               data-bookmark-name="${o.room.getDisplayName()}"
               @click=${o.removeBookmark}
               title="${ o.bookmarked ? i18n_remove_bookmark : i18n_add_bookmark }"></a>`;
    } else {
        return html`
            <a class="list-item-action fa fa-bookmark add-bookmark"
               data-room-jid="${o.room.get('jid')}"
               data-bookmark-name="${o.room.getDisplayName()}"
               @click=${o.addBookmark}
               title="${ o.bookmarked ? i18n_remove_bookmark : i18n_add_bookmark }"></a>`;
    }
}


const room_item = (o) => html`
    <div class="list-item controlbox-padded available-chatroom d-flex flex-row ${ o.currently_open(o.room) ? 'open' : '' } ${ o.room.get('num_unread_general') ? 'unread-msgs' : '' }"
         data-room-jid="${o.room.get('jid')}">

        ${ o.room.get('num_unread') ? unread_indicator(o) : '' }
        <a class="list-item-link open-room available-room w-100"
           data-room-jid="${o.room.get('jid')}"
           title="${i18n_open}"
           @click=${o.openRoom}>${o.room.getDisplayName()}</a>

        ${ o.allow_bookmarks ? bookmark(o) : '' }

        <a class="list-item-action room-info fa fa-info-circle"
           data-room-jid="${o.room.get('jid')}"
           title="${i18n_title}"
           @click=${o.showRoomDetailsModal}></a>

        <a class="list-item-action fa fa-sign-out-alt close-room"
           data-room-jid="${o.room.get('jid')}"
           data-room-name="${o.room.getDisplayName()}"
           title="${i18n_leave_room}"
           @click=${o.closeRoom}></a>
    </div>
`;

export default (o) => html`
    <div class="list-container list-container--openrooms ${ o.rooms.length ? '' : 'hidden' }">
        <a class="list-toggle open-rooms-toggle controlbox-padded" title="${i18n_desc_rooms}" @click=${o.toggleRoomsList}>
        <span class="fa ${ (o.toggle_state === o._converse.OPENED) ? 'fa-caret-down' : 'fa-caret-right' }"></span> ${i18n_rooms}</a>
        <div class="items-list rooms-list open-rooms-list ${ o.collapsed && 'collapsed' }">
            ${ o.rooms.map(room => room_item(Object.assign({room}, o))) }
        </div>
    </div>
`;
