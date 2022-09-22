import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from "lit";

export default (el) => {
    const i18n_nickname =  __('Nickname');
    const i18n_join = el.model?.isEntered() ? __('Change nickname') : __('Enter groupchat');
    const i18n_heading = api.settings.get('muc_show_logs_before_join') ?
        __('Choose a nickname to enter') :
        __('Please choose your nickname');

    const validation_message = el.model?.get('nickname_validation_message');

    return html`
        <div class="chatroom-form-container muc-nickname-form">
                <form class="converse-form chatroom-form converse-centered-form"
                        @submit=${ev => el.submitNickname(ev)}>
                <fieldset class="form-group">
                    <label>${i18n_heading}</label>
                    <p class="validation-message">${validation_message}</p>
                    <input type="text"
                        required="required"
                        name="nick"
                        value="${el.model?.get('nick') || ''}"
                        class="form-control ${validation_message ? 'error': ''}"
                        placeholder="${i18n_nickname}"/>
                </fieldset>
                <fieldset class="form-group">
                    <input type="submit"
                        class="btn btn-primary"
                        name="join"
                        value="${i18n_join}"/>
                </fieldset>
            </form>
        </div>`;
}
