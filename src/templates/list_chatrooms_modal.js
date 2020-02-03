import { html } from "lit-html";
import { repeat } from 'lit-html/directives/repeat.js';
import { __ } from '@converse/headless/i18n';
import { get, head } from "lodash";
import { modal_close_button, modal_header_close_button } from "./buttons"
import converse from "@converse/headless/converse-core";
import sizzle from 'sizzle';
import spinner from "./spinner.js";

const u = converse.env.utils;
const { Strophe } = converse.env;

const i18n_info_title = __('Show more information on this room');
const i18n_list_chatrooms = __('List Groupchats');
const i18n_no_rooms_found = __('No groupchats found on this server');
const i18n_open_title = __('Click to open this room');
const i18n_query = __('Show groupchats');
const i18n_rooms_found = __('Groupchats on this server');
const i18n_server_address = __('Server address');


const tpl_room_item = (o) => html`
    <li class="room-item list-group-item">
        <div class="available-chatroom">
            <a class="open-room available-room"
               @click=${o.openRoom}
               data-room-jid="${o.jid}"
               data-room-name="${o.name}"
               title="${i18n_open_title}">${o.name}</a>

            <a class="show-room-info fa fa-info-circle ${ o.rooms[o.jid]['toggled'] ? 'selected': '' }"
               data-room-jid="${o.jid}"
               @click=${() => o.toggleRoomInfo(o.jid)}
               title="${i18n_info_title}"></a>
        </div>
        ${ o.rooms[o.jid]['toggled'] ? renderRoomInfo(o.rooms[o.jid]['info']) : '' }
    </li>
`;

const tpl_rooms_list = (o) => html`
    <li class="list-group-item active">${ Object.keys(o.rooms).length ? i18n_rooms_found : i18n_no_rooms_found }</li>
    ${repeat(Object.keys(o.rooms), jid => jid, jid => renderRoomItem(o, jid)) }
`;


const tpl_room_info_wait = html`
    <div class="room-info">${spinner()}</div>
`;


const tpl_room_description = (o) => html`
    <div class="room-info">
        <p class="room-info"><strong>${o.label_jid}</strong> ${o.jid}</p>
        <p class="room-info"><strong>${o.label_desc}</strong> ${o.desc}</p>
        <p class="room-info"><strong>${o.label_occ}</strong> ${o.occ}</p>
        <p class="room-info"><strong>${o.label_features}</strong>
            <ul>
                ${ o.passwordprotected ? html`<li class="room-info locked">${o.label_requires_auth}</li>` : '' }
                ${ o.hidden ? html`<li class="room-info">${o.label_hidden}</li>` : '' }
                ${ o.membersonly ? html`<li class="room-info">${o.label_requires_invite}</li>` : '' }
                ${ o.moderated ? html`<li class="room-info">${o.label_moderated}</li>` : '' }
                ${ o.nonanonymous ? html`<li class="room-info">${o.label_non_anon}</li>` : '' }
                ${ o.open ? html`<li class="room-info">${o.label_open_room}</li>` : '' }
                ${ o.persistent ? html`<li class="room-info">${o.label_permanent_room}</li>` : '' }
                ${ o.publicroom ? html`<li class="room-info">${o.label_public}</li>` : '' }
                ${ o.semianonymous ? html`<li class="room-info">${o.label_semi_anon}</li>` : '' }
                ${ o.temporary ? html`<li class="room-info">${o.label_temp_room}</li>` : '' }
                ${ o.unmoderated ? html`<li class="room-info">${o.label_unmoderated}</li>` : '' }
            </ul>
        </p>
    </div>
`;


function renderRoomInfo (stanza) {
    if (stanza) {
        return tpl_room_description({
            'jid': stanza.getAttribute('from'),
            'desc': get(head(sizzle('field[var="muc#roominfo_description"] value', stanza)), 'textContent'),
            'occ': get(head(sizzle('field[var="muc#roominfo_occupants"] value', stanza)), 'textContent'),
            'hidden': sizzle('feature[var="muc_hidden"]', stanza).length,
            'membersonly': sizzle('feature[var="muc_membersonly"]', stanza).length,
            'moderated': sizzle('feature[var="muc_moderated"]', stanza).length,
            'nonanonymous': sizzle('feature[var="muc_nonanonymous"]', stanza).length,
            'open': sizzle('feature[var="muc_open"]', stanza).length,
            'passwordprotected': sizzle('feature[var="muc_passwordprotected"]', stanza).length,
            'persistent': sizzle('feature[var="muc_persistent"]', stanza).length,
            'publicroom': sizzle('feature[var="muc_publicroom"]', stanza).length,
            'semianonymous': sizzle('feature[var="muc_semianonymous"]', stanza).length,
            'temporary': sizzle('feature[var="muc_temporary"]', stanza).length,
            'unmoderated': sizzle('feature[var="muc_unmoderated"]', stanza).length,
            'label_desc': __('Description:'),
            'label_jid': __('Groupchat Address (JID):'),
            'label_occ': __('Participants:'),
            'label_features': __('Features:'),
            'label_requires_auth': __('Requires authentication'),
            'label_hidden': __('Hidden'),
            'label_requires_invite': __('Requires an invitation'),
            'label_moderated': __('Moderated'),
            'label_non_anon': __('Non-anonymous'),
            'label_open_room': __('Open'),
            'label_permanent_room': __('Permanent'),
            'label_public': __('Public'),
            'label_semi_anon':  __('Semi-anonymous'),
            'label_temp_room':  __('Temporary'),
            'label_unmoderated': __('Unmoderated')
        });
    } else {
        return tpl_room_info_wait;
    }
}

function renderRoomItem (o, jid) {
    const room = o.rooms[jid]['item'];
    const name = Strophe.unescapeNode(room.getAttribute('name') || room.getAttribute('jid'));
    return tpl_room_item(Object.assign({
        jid,
        'name': Strophe.xmlunescape(name),
    }, o));
}


const tpl_form = (o) => html`
    <form class="converse-form list-chatrooms" @submit=${o.showRooms}>
        <div class="form-group">
            <label for="chatroom">${i18n_server_address}:</label>
            <div class="input-group">
                <input type="text"
                    @change=${o.setDomainFromEvent}
                    value="${o.muc_domain}"
                    autofocus required
                    name="server"
                    class="form-control"
                    placeholder="${o.server_placeholder}"/>
                <input type="submit" class="btn btn-primary" name="list" value="${i18n_query}"/>
            </div>
        </div>
    </form>
`;


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="list-chatrooms-modal-label">${i18n_list_chatrooms}</h5>
                ${modal_header_close_button}
            </div>
            <div class="modal-body d-flex flex-column">
                <span class="modal-alert"></span>
                ${o.show_form ? tpl_form(o) : '' }
                <ul class="available-chatrooms list-group">
                    ${ !o.querying ? tpl_rooms_list(o) : spinner() }
                </ul>
            </div>
            <div class="modal-footer">${modal_close_button}</div>
        </div>
    </div>
`;
