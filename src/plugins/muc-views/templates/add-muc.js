import DOMPurify from 'dompurify';
import { __ } from 'i18n';
import { api } from '@converse/headless/core.js';
import { html } from "lit";
import { modal_header_close_button } from "plugins/modal/templates/buttons.js"
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getAutoCompleteList } from "../utils.js";


const nickname_input = (o) => {
    const i18n_nickname = __('Nickname');
    const i18n_required_field = __('This field is required');
        return html`
        <div class="form-group" >
            <label for="nickname">${i18n_nickname}:</label>
            <input type="text" title="${i18n_required_field}" required="required" name="nickname" value="${o.nick || ''}" class="form-control"/>
        </div>
    `;
}


export default (o) => {
    const i18n_join = __('Join');
    const i18n_enter = __('Enter a new Groupchat');
    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="add-chatroom-modal-label">${i18n_enter}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    <span class="modal-alert"></span>
                    <form class="converse-form add-chatroom">
                        <div class="form-group">
                            <label for="chatroom">${o.label_room_address}:</label>
                            ${ (o.muc_roomid_policy_error_msg) ? html`<label class="roomid-policy-error">${o.muc_roomid_policy_error_msg}</label>` : '' }
                            <converse-autocomplete
                                .getAutoCompleteList="${getAutoCompleteList}"
                                placeholder="${o.chatroom_placeholder}"
                                name="chatroom"/>
                        </div>
                        ${ o.muc_roomid_policy_hint ?  html`<div class="form-group">${unsafeHTML(DOMPurify.sanitize(o.muc_roomid_policy_hint, {'ALLOWED_TAGS': ['b', 'br', 'em']}))}</div>` : '' }
                        ${ !api.settings.get('locked_muc_nickname') ? nickname_input(o) : '' }
                        <input type="submit" class="btn btn-primary" name="join" value="${i18n_join || ''}" ?disabled=${o.muc_roomid_policy_error_msg}>
                    </form>
                </div>
            </div>
        </div>
    `;
}
