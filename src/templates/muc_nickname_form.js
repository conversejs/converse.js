import { __ } from '../i18n';
import { api } from "@converse/headless/converse-core";
import { html } from "lit-html";


export default (o) => {
    const i18n_nickname =  __('Nickname');
    const i18n_join = __('Enter groupchat');
    const i18n_heading = api.settings.get('muc_show_logs_before_join') ?
        __('Choose a nickname to enter') :
        __('Please choose your nickname');

    return html`
        <div class="chatroom-form-container muc-nickname-form">
            <form class="converse-form chatroom-form converse-centered-form">
                <fieldset class="form-group">
                    <label>${i18n_heading}</label>
                    <p class="validation-message">${o.nickname_validation_message}</p>
                    <input type="text"
                        required="required"
                        name="nick"
                        value="${o.nick || ''}"
                        class="form-control ${o.nickname_validation_message ? 'error': ''}"
                        placeholder="${i18n_nickname}"/>
                </fieldset>
                <fieldset class="form-group">
                    <input type="submit" class="btn btn-primary" name="join" value="${i18n_join}"/>
                </fieldset>
            </form>
        </div>`;
}
