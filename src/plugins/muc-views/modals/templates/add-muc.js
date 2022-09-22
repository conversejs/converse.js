import DOMPurify from 'dompurify';
import { __ } from 'i18n';
import { api } from '@converse/headless/core.js';
import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getAutoCompleteList } from "../../search.js";


const nickname_input = (el) => {
    const i18n_nickname = __('Nickname');
    const i18n_required_field = __('This field is required');
        return html`
            <div class="form-group" >
                <label for="nickname">${i18n_nickname}:</label>
                <input type="text"
                    title="${i18n_required_field}"
                    required="required"
                    name="nickname"
                    value="${el.model.get('nick') || ''}"
                    class="form-control"/>
            </div>
    `;
}

export default (el) => {
    const i18n_join = __('Join');
    const muc_domain = el.model.get('muc_domain') || api.settings.get('muc_domain');

    let placeholder = '';
    if (!api.settings.get('locked_muc_domain')) {
        placeholder = muc_domain ? `name@${muc_domain}` : __('name@conference.example.org');
    }

    const label_room_address = muc_domain ? __('Groupchat name') :  __('Groupchat address');
    const muc_roomid_policy_error_msg = el.muc_roomid_policy_error_msg;
    const muc_roomid_policy_hint = api.settings.get('muc_roomid_policy_hint');
    return html`
        <form class="converse-form add-chatroom" @submit=${(ev) => el.openChatRoom(ev)}>
            <div class="form-group">
                <label for="chatroom">${label_room_address}:</label>
                ${ (muc_roomid_policy_error_msg) ? html`<label class="roomid-policy-error">${muc_roomid_policy_error_msg}</label>` : '' }
                <converse-autocomplete
                    .getAutoCompleteList=${getAutoCompleteList}
                    ?autofocus=${true}
                    min_chars="3"
                    position="below"
                    placeholder="${placeholder}"
                    class="add-muc-autocomplete"
                    name="chatroom">
                </converse-autocomplete>
            </div>
            ${ muc_roomid_policy_hint ?  html`<div class="form-group">${unsafeHTML(DOMPurify.sanitize(muc_roomid_policy_hint, {'ALLOWED_TAGS': ['b', 'br', 'em']}))}</div>` : '' }
            ${ !api.settings.get('locked_muc_nickname') ? nickname_input(el) : '' }
            <input type="submit" class="btn btn-primary" name="join" value="${i18n_join || ''}" ?disabled=${muc_roomid_policy_error_msg}/>
        </form>
    `;
}
