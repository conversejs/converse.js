import { __ } from '../i18n';
import { html } from "lit-html";
import { repeat } from 'lit-html/directives/repeat.js';
import { modal_close_button, modal_header_close_button } from "./buttons"
import spinner from "./spinner.js";


const form = (o) => {
    const i18n_query = __('Show groupchats');
    const i18n_server_address = __('Server address');
    return html`
        <form class="converse-form list-chatrooms"
            @submit=${o.submitForm}>
            <div class="form-group">
                <label for="chatroom">${i18n_server_address}:</label>
                <input type="text"
                    @change=${o.setDomainFromEvent}
                    value="${o.muc_domain || ''}"
                    required="required"
                    name="server"
                    class="form-control"
                    placeholder="${o.server_placeholder}"/>
            </div>
            <input type="submit" class="btn btn-primary" name="list" value="${i18n_query}"/>
        </form>
    `;
}


const tpl_item = (o, item) => {
    const i18n_info_title = __('Show more information on this groupchat');
    const i18n_open_title = __('Click to open this groupchat');
    return html`
        <li class="room-item list-group-item">
            <div class="available-chatroom d-flex flex-row">
                <a class="open-room available-room w-100"
                @click=${o.openRoom}
                data-room-jid="${item.jid}"
                data-room-name="${item.name}"
                title="${i18n_open_title}"
                href="#">${item.name || item.jid}</a>
                <a class="right room-info icon-room-info"
                @click=${o.toggleRoomInfo}
                data-room-jid="${item.jid}"
                title="${i18n_info_title}"
                href="#"></a>
            </div>
        </li>
    `;
}


export default (o) => {
    const i18n_list_chatrooms = __('Query for Groupchats');
    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="list-chatrooms-modal-label">${i18n_list_chatrooms}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body d-flex flex-column">
                    <span class="modal-alert"></span>
                    ${o.show_form ? form(o) : '' }
                    <ul class="available-chatrooms list-group">
                        ${ o.loading_items ? html`<li class="list-group-item"> ${spinner()} </li>` : '' }
                        ${ o.feedback_text ? html`<li class="list-group-item active">${ o.feedback_text }</li>` : '' }
                        ${repeat(o.items, item => item.jid, item => tpl_item(o, item))}
                    </ul>
                </div>
                <div class="modal-footer">${modal_close_button}</div>
            </div>
        </div>
    `;
}
