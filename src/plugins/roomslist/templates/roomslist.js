import AddMUCModal from 'plugins/muc-views/modals/add-muc.js';
import MUCListModal from 'plugins/muc-views/modals/muc-list.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { html } from "lit";


const bookmark = (o) => {
    const i18n_add_bookmark = __('Bookmark this groupchat');
    const i18n_remove_bookmark = __('Unbookmark this groupchat');
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


const unread_indicator = (o) => html`<span class="list-item-badge badge badge--muc msgs-indicator">${ o.room.get('num_unread') }</span>`;
const activity_indicator = () => html`<span class="list-item-badge badge badge--muc msgs-indicator"></span>`;


const room_item = (o) => {
    const i18n_leave_room = __('Leave this groupchat');
    const has_unread_msgs = o.room.get('num_unread_general') || o.room.get('has_activity');
    return html`
        <div class="list-item controlbox-padded available-chatroom d-flex flex-row ${ o.currently_open(o.room) ? 'open' : '' } ${ has_unread_msgs ? 'unread-msgs' : '' }"
            data-room-jid="${o.room.get('jid')}">

            ${ o.room.get('num_unread') ? unread_indicator(o) : (o.room.get('has_activity') ? activity_indicator(o) : '') }

            <a class="list-item-link open-room available-room w-100"
                data-room-jid="${o.room.get('jid')}"
                title="${__('Click to open this groupchat')}"
                @click=${o.openRoom}>${o.room.getDisplayName()}</a>

            ${ api.settings.get('allow_bookmarks') ? bookmark(o) : '' }

            <a class="list-item-action room-info fa fa-info-circle"
                data-room-jid="${o.room.get('jid')}"
                title="${__('Show more information on this groupchat')}"
                @click=${o.showRoomDetailsModal}></a>

            <a class="list-item-action fa fa-sign-out-alt close-room"
                data-room-jid="${o.room.get('jid')}"
                data-room-name="${o.room.getDisplayName()}"
                title="${i18n_leave_room}"
                @click=${o.closeRoom}></a>
        </div>`;
}

export default (o) => {
    const i18n_desc_rooms = __('Click to toggle the list of open groupchats');
    const i18n_heading_chatrooms = __('Groupchats');
    const i18n_title_list_rooms = __('Query for groupchats');
    const i18n_title_new_room = __('Add a new groupchat');
    return html`
        <div class="d-flex controlbox-padded">
            <span class="w-100 controlbox-heading controlbox-heading--groupchats">${i18n_heading_chatrooms}</span>
            <a class="controlbox-heading__btn show-list-muc-modal"
                @click=${(ev) => api.modal.show(MUCListModal, { 'model': o.model }, ev)}
                title="${i18n_title_list_rooms}" data-toggle="modal" data-target="#muc-list-modal">
                    <converse-icon class="fa fa-list-ul right" path-prefix="/dist" size="1em"></converse-icon>
            </a>
            <a class="controlbox-heading__btn show-add-muc-modal"
                @click=${(ev) => api.modal.show(AddMUCModal, { 'model': o.model }, ev)}
                title="${i18n_title_new_room}" data-toggle="modal" data-target="#add-chatrooms-modal">
                    <converse-icon class="fa fa-plus right" path-prefix="/dist" size="1em"></converse-icon>
            </a>
        </div>

        <div class="list-container list-container--openrooms ${ o.rooms.length ? '' : 'hidden' }">
            <a class="list-toggle open-rooms-toggle controlbox-padded" title="${i18n_desc_rooms}" @click=${o.toggleRoomsList}>
            <span class="fa ${ (o.toggle_state === _converse.OPENED) ? 'fa-caret-down' : 'fa-caret-right' }"></span> ${__('Open Groupchats')}</a>
            <div class="items-list rooms-list open-rooms-list ${ o.collapsed && 'collapsed' }">
                ${ o.rooms.map(room => room_item(Object.assign({room}, o))) }
            </div>
        </div>`;
}
