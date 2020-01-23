import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { modal_close_button, modal_header_close_button } from "./buttons"

const i18n_list_chatrooms = __('Query for Groupchats');
const i18n_server_address = __('Server address');
const i18n_query = __('Show groupchats');


const form = (o) => html`
    <form class="converse-form list-chatrooms">
        <div class="form-group">
            <label for="chatroom">${i18n_server_address}:</label>
            <input type="text" value="${o.muc_domain}" required="required" name="server" class="form-control" placeholder="${o.server_placeholder}"/>
        </div>
        <input type="submit" class="btn btn-primary" name="list" value="${i18n_query}"/>
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
                ${o.show_form ? form(o) : '' }
                <ul class="available-chatrooms list-group"></ul>
            </div>
            <div class="modal-footer">${modal_close_button}</div>
        </div>
    </div>
`;
