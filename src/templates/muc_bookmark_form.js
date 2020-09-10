import { html } from "lit-html";
import { __ } from '../i18n';


export default (o) => {
    const i18n_heading = __('Bookmark this groupchat');
    const i18n_autojoin = __('Would you like this groupchat to be automatically joined upon startup?');
    const i18n_cancel = __('Cancel');
    const i18n_name = __('The name for this bookmark:');
    const i18n_nick = __('What should your nickname for this groupchat be?');
    const i18n_submit = __('Save');
    return html`
        <form class="converse-form chatroom-form" @submit=${o.onSubmit}>
            <legend>${i18n_heading}</legend>
            <fieldset class="form-group">
                <label for="converse_muc_bookmark_name">${i18n_name}</label>
                <input class="form-control" type="text" value="${o.name}" name="name" required="required" id="converse_muc_bookmark_name"/>
            </fieldset>
            <fieldset class="form-group">
                <label for="converse_muc_bookmark_nick">${i18n_nick}</label>
                <input class="form-control" type="text" name="nick" value="${o.nick || ''}" id="converse_muc_bookmark_nick"/>
            </fieldset>
            <fieldset class="form-group form-check">
                <input class="form-check-input" id="converse_muc_bookmark_autojoin" type="checkbox" name="autojoin"/>
                <label class="form-check-label" for="converse_muc_bookmark_autojoin">${i18n_autojoin}</label>
            </fieldset>
            <fieldset class="form-group">
                <input class="btn btn-primary" type="submit" value="${i18n_submit}">
                <input class="btn btn-secondary button-cancel" type="button" value="${i18n_cancel}" @click=${o.onCancel}>
            </fieldset>
        </form>
    `;
}
