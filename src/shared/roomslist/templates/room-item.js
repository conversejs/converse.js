/**
 * @typedef {import('plugins/roomslist/view').RoomsList} RoomsList
 * @typedef {import('plugins/bookmark-views/components/bookmarks-pin-list').BookmarksPinView} BookmarksPinView
 * @typedef {import('@converse/headless').MUC} MUC
 */
import { html } from "lit";
import { api, u } from "@converse/headless";
import 'plugins/muc-views/modals/add-muc.js';
import 'plugins/muc-views/modals/muc-list.js';
import { __ } from 'i18n';
import { getUnreadMsgsDisplay } from "shared/chat/utils";

const { isUniView } = u;

/** @param {MUC} room */
function isCurrentlyOpen (room) {
    return isUniView() && !room.get('hidden');
}

/** @param {MUC} room */
function tplUnreadIndicator (room) {
    return html`<span class="list-item-badge badge badge--muc msgs-indicator">${ getUnreadMsgsDisplay(room) }</span>`;
}

function tplActivityIndicator () {
    return html`<span class="list-item-badge badge badge--muc msgs-indicator"></span>`;
}

/**
 * @param {RoomsList|BookmarksPinView} el
 * @param {MUC} room
 */
export function tplRoomItem (el, room) {
    const i18n_leave_room = __('Leave this groupchat');
    const has_unread_msgs = room.get('num_unread_general') || room.get('has_activity');

    const buttons = [
        tplRoomMenuItem({
            room,
            alt_text: i18n_leave_room,
            text: __('Leave'),
            icon_class: 'fa-sign-out-alt',
            handler: (ev) => el.closeRoom(ev)
        }),
    ];

    if (api.settings.get('allow_bookmarks')) {
        if (!room.get('pinned')) {
            buttons.push(tplRoomMenuItem({
                room,
                alt_text: __('Pin this groupchat to the top of the list'),
                text: __('Pin'),
                icon_class: 'fa-bookmark',
                handler: (ev) => el.pinRoom(ev)
            }))
        } else {
            buttons.push(tplRoomMenuItem({
                room,
                alt_text: __('Unpin this groupchat from the top of the list'),
                text:  __('Unpin'),
                icon_class: 'fa-bookmark-empty',
                handler: (ev) => el.unpinRoom(ev)
            }))
        }
    }

    return html`
        <li class="list-item controlbox-padded available-chatroom d-flex flex-row ${ isCurrentlyOpen(room) ? 'open' : '' } ${ has_unread_msgs ? 'unread-msgs' : '' }"
            data-room-jid="${room.get('jid')}">

            <a class="list-item-link open-room available-room w-100"
                data-room-jid="${room.get('jid')}"
                data-room-name="${room.getDisplayName()}"
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

            <converse-dropdown class="btn-group dropstart list-item-action" .items=${buttons}></converse-dropdown>
        </li>`;
}

/**
 * @param {Object} config
 * @param {MUC} config.room
 * @param {string} config.alt_text
 * @param {string} config.text
 * @param {function} config.handler
 * @param {string} config.icon_class
 * @returns 
 */
function tplRoomMenuItem (config) {
    const { room, alt_text, text, handler, icon_class } = config;
    return html`<a class="dropdown-item" role="button"
            @click="${handler}"
            tabindex="0"
            data-room-jid="${room.get('jid')}"
            data-room-name="${room.getDisplayName()}"
            title="${alt_text}">
                <converse-icon class="fa ${icon_class}" size="1em" color="${ isCurrentlyOpen(room) ? 'var(--foreground-color)' : '' }"></converse-icon>
                ${text}
        </a>`;
}
