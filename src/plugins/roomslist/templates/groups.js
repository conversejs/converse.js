import { __ } from 'i18n';
import { html } from "lit";
import { tplRoomItem } from 'plugins/roomslist/templates/roomslist.js'

import '../styles/roomsgroups.scss';

function tplRoomDomainGroup (el, domain, rooms) {
    const i18n_title = __('Click to hide these rooms');
    const collapsed = el.model.get('collapsed_domains');
    const is_collapsed = collapsed.includes(domain);
    return html`
    <div class="muc-domain-group" data-domain="${domain}">
        <a href="#" class="list-toggle muc-domain-group-toggle controlbox-padded" title="${i18n_title}" @click=${ev => el.toggleDomainList(ev, domain)}>
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

export function tplRoomDomainGroupList (el, rooms) {
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
