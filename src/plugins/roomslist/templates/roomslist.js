/**
 * @typedef {import('../view').RoomsList} RoomsList
 * @typedef {import('@converse/headless').MUC} MUC
 */
import { html } from "lit";
import { _converse, api, u, constants } from "@converse/headless";
import 'plugins/muc-views/modals/add-muc.js';
import 'plugins/muc-views/modals/muc-list.js';
import { __ } from 'i18n';
import { addBookmarkViaEvent } from 'plugins/bookmark-views/utils.js';

import '../styles/roomsgroups.scss';

const { CHATROOMS_TYPE, CLOSED } = constants;
const { isUniView } = u;

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
function tplRoomItem (el, room) {
    const i18n_leave_room = __('Leave this groupchat');
    const has_unread_msgs = room.get('num_unread_general') || room.get('has_activity');
    return html`
        <li class="list-item controlbox-padded available-chatroom d-flex flex-row ${ isCurrentlyOpen(room) ? 'open' : '' } ${ has_unread_msgs ? 'unread-msgs' : '' }"
            data-room-jid="${room.get('jid')}">

            <a class="list-item-link open-room available-room w-100"
                data-room-jid="${room.get('jid')}"
                title="${__('Click to open this groupchat')}"
                @click=${ev => el.openRoom(ev)}>
                <converse-avatar
                    .model=${room}
                    class="avatar avatar-muc"
                    name="${room.getDisplayName()}"
                    nonce=${room.vcard?.get('vcard_updated')}
                    height="30" width="30"></converse-avatar>
                <span>${ room.get('num_unread') ?
                            tplUnreadIndicator(room) :
                            (room.get('has_activity') ? tplActivityIndicator() : '') }
                    ${room.getDisplayName()}</span>
            </a>

            ${ api.settings.get('allow_bookmarks') ? tplBookmark(room) : '' }

            <a class="list-item-action close-room"
                data-room-jid="${room.get('jid')}"
                data-room-name="${room.getDisplayName()}"
                title="${i18n_leave_room}"
                @click=${ev => el.closeRoom(ev)}>
                <converse-icon
                    class="fa fa-sign-out-alt"
                    size="1.2em"
                    color="${ isCurrentlyOpen(room) ? 'var(--inverse-link-color)' : '' }"></converse-icon>
            </a>
        </li>`;
}

/**
 * @param {RoomsList} el
 * @param {string} domain
 * @param {MUC[]} rooms
 */
function tplRoomDomainGroup (el, domain, rooms) {
    const i18n_title = __('Click to hide these rooms');
    const collapsed = el.model.get('collapsed_domains');
    const is_collapsed = collapsed.includes(domain);
    return html`
    <div class="muc-domain-group" data-domain="${domain}">
        <a href="#"
           class="list-toggle muc-domain-group-toggle controlbox-padded"
           title="${i18n_title}"
           @click=${ev => el.toggleDomainList(ev, domain)}>

            <converse-icon
                class="fa ${ is_collapsed ? 'fa-caret-right' : 'fa-caret-down' }"
                size="1em"
                color="var(--groupchats-header-color)"></converse-icon>
            ${domain}
        </a>
        <ul class="items-list muc-domain-group-rooms ${ is_collapsed ? 'collapsed' : '' }" data-domain="${domain}">
            ${ rooms.map(room => tplRoomItem(el, room)) }
        </ul>
    </div>`;
}

/**
 * @param {RoomsList} el
 * @param {MUC[]} rooms
 */
function tplRoomDomainGroupList (el, rooms) {
    // The rooms should stay sorted as they are iterated and added in order
    const grouped_rooms = new Map();
    for (const room of rooms) {
        const roomdomain = room.get('jid').split('@').at(-1).toLowerCase();
        if (grouped_rooms.has(roomdomain)) {
            grouped_rooms.get(roomdomain).push(room);
        } else {
            grouped_rooms.set(roomdomain, [room]);
        }
    }
    const sorted_domains = Array.from(grouped_rooms.keys());
    sorted_domains.sort();

    return sorted_domains.map(domain => tplRoomDomainGroup(el, domain, grouped_rooms.get(domain)))
}

/**
 * @param {RoomsList} el
 */
export default (el) => {
    const group_by_domain = api.settings.get('muc_grouped_by_domain');
    const { chatboxes } = _converse.state;
    const rooms = chatboxes.filter((m) => m.get('type') === CHATROOMS_TYPE);
    rooms.sort((a, b) => (a.getDisplayName().toLowerCase() <= b.getDisplayName().toLowerCase() ? -1 : 1));

    const i18n_desc_rooms = __('Click to toggle the list of open groupchats');
    const i18n_heading_chatrooms = __('Groupchats');
    const i18n_title_list_rooms = __('Query server');
    const i18n_title_new_room = __('Add groupchat');
    const i18n_show_bookmarks = __('Bookmarks');
    const is_closed = el.model.get('toggle_state') === CLOSED;

    const btns = [
        html`<a class="dropdown-item show-bookmark-list-modal" role="button"
                @click=${(ev) => api.modal.show('converse-bookmark-list-modal', { 'model': el.model }, ev)}
                data-toggle="modal">
                    <converse-icon class="fa fa-bookmark" size="1em"></converse-icon>
                    ${i18n_show_bookmarks}
        </a>`,
        html`<a class="dropdown-item show-list-muc-modal" role="button"
                @click=${(ev) => api.modal.show('converse-muc-list-modal', { 'model': el.model }, ev)}
                data-toggle="modal"
                data-target="#muc-list-modal">
                    <converse-icon class="fa fa-list-ul" size="1em"></converse-icon>
                    ${i18n_title_list_rooms}
        </a>`,
        html`<a class="dropdown-item show-add-muc-modal" role="button"
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

                    ${i18n_heading_chatrooms}

                    ${rooms.length ? html`<converse-icon
                        class="fa ${ is_closed ? 'fa-caret-right' : 'fa-caret-down' }"
                        size="1em"
                        color="var(--muc-color)"></converse-icon>` : '' }
                </a>
            </span>
            <converse-dropdown class="btn-group dropstart" .items=${btns}></converse-dropdown>
        </div>

        <div class="list-container list-container--openrooms ${ rooms.length ? '' : 'hidden' }">
            <ul class="items-list rooms-list open-rooms-list ${ is_closed ? 'collapsed' : '' }">
                ${ group_by_domain ?
                    tplRoomDomainGroupList(el, rooms) :
                    rooms.map(/** @param {MUC} room */(room) => tplRoomItem(el, room))
                }
            </ul>
        </div>`;
}
