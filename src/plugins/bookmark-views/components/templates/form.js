import { html } from "lit";
import { __ } from 'i18n';


export default (el) => {
    const name = el.model.getDisplayName();
    const nick = el.bookmark?.get('nick') ?? el.model.get('nick');

    const i18n_heading = __('Bookmark for "%1$s"', name);
    const i18n_autojoin = __('Would you like this groupchat to be automatically joined upon startup?');
    const i18n_remove = __('Remove');
    const i18n_name = __('The name for this bookmark:');
    const i18n_nick = __('What should your nickname for this groupchat be?');
    const i18n_submit = el.bookmark ? __('Update') : __('Save');

    return html`
        <form class="converse-form chatroom-form" @submit=${(ev) => el.onBookmarkFormSubmitted(ev)}>
            <legend>${i18n_heading}</legend>
            <fieldset>
                <label class="form-label" for="converse_muc_bookmark_name">${i18n_name}</label>
                <input class="form-control" type="text" value="${name}" name="name" required="required" id="converse_muc_bookmark_name"/>
            </fieldset>
            <fieldset>
                <label class="form-label" for="converse_muc_bookmark_nick">${i18n_nick}</label>
                <input class="form-control" type="text" name="nick" value="${nick || ''}" id="converse_muc_bookmark_nick"/>
            </fieldset>
            <fieldset class="form-group form-check">
                <input class="form-check-input" id="converse_muc_bookmark_autojoin" type="checkbox" ?checked=${el.bookmark?.get('autojoin')} name="autojoin"/>
                <label class="form-check-label" for="converse_muc_bookmark_autojoin">${i18n_autojoin}</label>
            </fieldset>
            <fieldset>
                <input class="btn btn-primary" type="submit" value="${i18n_submit}">
                    ${el.bookmark ? html`<input class="btn btn-secondary button-remove" type="button" value="${i18n_remove}" @click=${(ev) => el.removeBookmark(ev)}>` : '' }
            </fieldset>
        </form>
    `;
}
