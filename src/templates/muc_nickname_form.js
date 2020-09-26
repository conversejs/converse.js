import { __ } from '../i18n';
import { api } from "@converse/headless/converse-core";
import { html } from "lit-html";


export default (nickname) => {
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
                    <input type="text" required="required" name="nick" value="${nickname}"
                        class="form-control" placeholder="${i18n_nickname}"/>
                </fieldset>
                <fieldset class="form-group">
                    <input type="submit" class="btn btn-primary" name="join" value="${i18n_join}"/>
                </fieldset>
            </form>
        </div>`;
}
