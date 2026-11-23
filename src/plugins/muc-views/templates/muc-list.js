import { __ } from 'i18n';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import spinner from 'templates/spinner.js';
import tplMUCDescription from './muc-description.js';

const form = (o) => {
    const i18n_query = __('Show groupchats');
    const i18n_server_address = __('Server address');
    return html`
        <form class="converse-form list-chatrooms" @submit=${o.submitForm}>
            <div>
                <label class="form-label" for="chatroom">${i18n_server_address}:</label>
                <input
                    type="text"
                    autofocus
                    @change=${o.setDomainFromEvent}
                    value="${o.muc_domain || ''}"
                    required="required"
                    name="server"
                    class="form-control"
                    placeholder="${o.server_placeholder}"
                />
            </div>
            <input type="submit" class="btn btn-primary" name="list" value="${i18n_query}" />
        </form>
    `;
};

/**
 * @param {object} o
 * @param {Record<string, string>} item
 */
const tplItem = (o, item) => {
    const i18n_info_title = __('Show more information on this groupchat');
    const i18n_open_title = __('Click to open this groupchat');
    const expanded = o.room_info.has(item.jid);
    const info = o.room_info.get(item.jid);
    return html`
        <li class="room-item list-group-item">
            <div class="available-chatroom d-flex flex-row align-items-center">
                <a
                    class="open-room available-room w-100"
                    @click=${o.openRoom}
                    data-room-jid="${item.jid}"
                    data-room-name="${item.name}"
                    title="${i18n_open_title}"
                    href="#"
                    >${item.name || item.jid}</a
                >
                <a
                    class="room-info ${expanded ? 'selected' : ''}"
                    @click=${o.toggleRoomInfo}
                    data-room-jid="${item.jid}"
                    title="${i18n_info_title}"
                    aria-label="${i18n_info_title}"
                    aria-expanded="${expanded}"
                    role="button"
                    href="#"
                    ><converse-icon class="fa fa-info-circle" size="1em"></converse-icon
                ></a>
            </div>
            ${expanded ? (info ? tplMUCDescription(info) : spinner()) : ''}
        </li>
    `;
};

export default (o) => {
    return html`
        ${o.show_form ? form(o) : ''}
        <ul class="available-chatrooms list-group">
            ${o.loading_items ? html`<li class="list-group-item">${spinner()}</li>` : ''}
            ${o.feedback_text ? html`<li class="list-group-item active">${o.feedback_text}</li>` : ''}
            ${repeat(
                o.items,
                (item) => item.jid,
                (item) => tplItem(o, item),
            )}
        </ul>
    `;
};
