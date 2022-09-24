import { __ } from 'i18n';
import { html } from "lit";
import { repeat } from 'lit/directives/repeat.js';
import spinner from "templates/spinner.js";


const form = (o) => {
    const i18n_query = __('Show groupchats');
    const i18n_server_address = __('Server address');
    return html`
        <form class="converse-form list-chatrooms"
            @submit=${o.submitForm}>
            <div class="form-group">
                <label for="chatroom">${i18n_server_address}:</label>
                <input type="text"
                    autofocus
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
    return html`
        ${o.show_form ? form(o) : '' }
        <ul class="available-chatrooms list-group">
            ${ o.loading_items ? html`<li class="list-group-item"> ${spinner()} </li>` : '' }
            ${ o.feedback_text ? html`<li class="list-group-item active">${ o.feedback_text }</li>` : '' }
            ${repeat(o.items, item => item.jid, item => tpl_item(o, item))}
        </ul>
    `;
}
