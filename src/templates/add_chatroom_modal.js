import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { modal_header_close_button } from "./buttons"


const i18n_join = __('Join');
const i18n_enter = __('Enter a new Groupchat');
const i18n_nickname = __('Nickname');
const i18n_required_field = __('This field is required');


const nickname_input = (o) => html`
    <div class="form-group" >
        <label for="nickname">${i18n_nickname}:</label>
        <input type="text" title="${i18n_required_field}" required="required" name="nickname" value="${o.nick || ''}" class="form-control"/>
    </div>
`;


export default (o) => html`
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
                        <input type="text" required="required" name="chatroom" class="form-control roomjid-input" placeholder="${o.chatroom_placeholder}"/>
                    </div>
                    ${ o.muc_roomid_policy_hint ?  html`<div class="form-group">{{o.muc_roomid_policy_hint}}</div>` : '' }
                    ${ !o._converse.locked_muc_nickname ? nickname_input(o) : '' }
                    <input type="submit" class="btn btn-primary" name="join" value="${i18n_join || ''}" ?disabled=${o.muc_roomid_policy_error_msg}>
                </form>
            </div>
        </div>
    </div>
`;
