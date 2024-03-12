/**
 * @typedef {import('../view').RoomsList} RoomsList
 * @typedef {import('@converse/headless/plugins/muc/muc').default} MUC
 */
import 'plugins/muc-views/modals/add-muc.js';
import 'plugins/muc-views/modals/muc-list.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless";
import { html } from "lit";
import { isUniView } from '@converse/headless/utils/session.js';
import { addBookmarkViaEvent } from 'plugins/bookmark-views/utils.js';
import { tplRoomDomainGroupList } from 'plugins/roomslist/templates/groups.js';
import { CHATROOMS_TYPE, CLOSED } from '@converse/headless/shared/constants.js';


/** @param {MUC} room */
function isCurrentlyOpen (room) {
    return isUniView() && !room.get('hidden');
}

/** @param {MUC} room */
function tplBookmark (room) {
    const bm = room.get('bookmarked') ?? false;
    const i18n_bookmark = __('Bookmark');
    return html`
        <a class="list-item-action add-bookmark"
            data-room-jid="${room.get('jid')}"
            data-bookmark-name="${room.getDisplayName()}"
            @click=${(ev) => addBookmarkViaEvent(ev)}
            title="${ i18n_bookmark }">

            <converse-icon class="fa ${bm ? 'fa-bookmark' : 'fa-bookmark-empty'}"
                           size="1.2em"
                           color="${ isCurrentlyOpen(room) ? 'var(--inverse-link-color)' : '' }"></converse-icon>
        </a>`;
}


/** @param {MUC} room */
function tplUnreadIndicator (room) {
    return html`<span class="list-item-badge badge badge--muc msgs-indicator">${ room.get('num_unread') }</span>`;
}

function tplActivityIndicator () {
    return html`<span class="list-item-badge badge badge--muc msgs-indicator"></span>`;
}


/**
 * @param {RoomsList} el
 * @param {MUC} room
 */
export function tplRoomItem (el, room) {
    const i18n_leave_room = __('Leave this groupchat');
    const has_unread_msgs = room.get('num_unread_general') || room.get('has_activity');
    return html`
        <div class="list-item controlbox-padded available-chatroom d-flex flex-row ${ isCurrentlyOpen(room) ? 'open' : '' } ${ has_unread_msgs ? 'unread-msgs' : '' }"
            data-room-jid="${room.get('jid')}">

            ${ room.get('num_unread') ? tplUnreadIndicator(room) : (room.get('has_activity') ? tplActivityIndicator() : '') }

            <a class="list-item-link open-room available-room w-100"
                data-room-jid="${room.get('jid')}"
                title="${__('Click to open this groupchat')}"
                @click=${ev => el.openRoom(ev)}>${room.getDisplayName()}</a>

            ${ api.settings.get('allow_bookmarks') ? tplBookmark(room) : '' }

            <a class="list-item-action room-info"
                data-room-jid="${room.get('jid')}"
                title="${__('Show more information on this groupchat')}"
                @click=${ev => el.showRoomDetailsModal(ev)}>

                <converse-icon class="fa fa-info-circle" size="1.2em" color="${ isCurrentlyOpen(room) ? 'var(--inverse-link-color)' : '' }"></converse-icon>
            </a>

            <a class="list-item-action close-room"
                data-room-jid="${room.get('jid')}"
                data-room-name="${room.getDisplayName()}"
                title="${i18n_leave_room}"
                @click=${ev => el.closeRoom(ev)}>
                <converse-icon class="fa fa-sign-out-alt" size="1.2em" color="${ isCurrentlyOpen(room) ? 'var(--inverse-link-color)' : '' }"></converse-icon>
            </a>
        </div>`;
}

/**
 * @param {RoomsList} el
 */
export default (el) => {
    const group_by_domain = api.settings.get('muc_grouped_by_domain');
    const { chatboxes } = _converse.state;
    const rooms = chatboxes.filter(m => m.get('type') === CHATROOMS_TYPE);
    rooms.sort((a, b) => (a.getDisplayName().toLowerCase() <= b.getDisplayName().toLowerCase() ? -1 : 1));

    const i18n_desc_rooms = __('Click to toggle the list of open groupchats');
    const i18n_heading_chatrooms = __('Groupchats');
    const i18n_title_list_rooms = __('Query server');
    const i18n_title_new_room = __('Add groupchat');
    const i18n_show_bookmarks = __('Bookmarks');
    const is_closed = el.model.get('toggle_state') === CLOSED;

    const btns = [
        html`<a class="dropdown-item show-bookmark-list-modal"
                @click=${(ev) => api.modal.show('converse-bookmark-list-modal', { 'model': el.model }, ev)}
                data-toggle="modal">
                    <converse-icon class="fa fa-bookmark" size="1em"></converse-icon>
                    ${i18n_show_bookmarks}
        </a>`,
        html`<a class="dropdown-item show-list-muc-modal"
                @click=${(ev) => api.modal.show('converse-muc-list-modal', { 'model': el.model }, ev)}
                data-toggle="modal"
                data-target="#muc-list-modal">
                    <converse-icon class="fa fa-list-ul" size="1em"></converse-icon>
                    ${i18n_title_list_rooms}
        </a>`,
        html`<a class="dropdown-item show-add-muc-modal"
                @click=${(ev) => api.modal.show('converse-add-muc-modal', { 'model': el.model }, ev)}
                data-toggle="modal"
                data-target="#add-chatrooms-modal">
                    <converse-icon class="fa fa-plus" size="1em"></converse-icon>
                    ${i18n_title_new_room}
        </a>`,
    ];

    return html`
        <div class="d-flex controlbox-padded">
            <span class="w-100 controlbox-heading controlbox-heading--groupchats">
                <a class="list-toggle open-rooms-toggle"
                   title="${i18n_desc_rooms}"
                   @click=${ev => el.toggleRoomsList(ev)}>

                    <converse-icon
                        class="fa ${ is_closed ? 'fa-caret-right' : 'fa-caret-down' }"
                        size="1em"
                        color="var(--muc-color)"></converse-icon>
                    ${i18n_heading_chatrooms}
                </a>
            </span>
            <converse-dropdown class="dropleft" .items=${btns}></converse-dropdown>
        </div>

        <div class="list-container list-container--openrooms ${ rooms.length ? '' : 'hidden' }">
            <div class="items-list rooms-list open-rooms-list ${ is_closed ? 'collapsed' : '' }">
                ${ group_by_domain ?
                    tplRoomDomainGroupList(el, rooms) :
                    rooms.map(room => tplRoomItem(el, room))
                }
            </div>
        </div>`;
}
