import { __ } from 'i18n';
import { html } from 'lit';

export default el => {
    const i18n_submit = __('Submit');
    const i18n_passwords_must_match = __('The new passwords must match');
    const i18n_new_password = __('New password');
    const i18n_confirm_password = __('Confirm new password');

    return html`<form class="converse-form passwordreset-form" method="POST" @submit=${ev => el.onSubmit(ev)}>
        ${el.alert_message ? html`<div class="alert alert-danger" role="alert">${el.alert_message}</div>` : ''}

        <div class="form-group">
            <label for="converse_password_reset_new">${i18n_new_password}</label>
            <input
                class="form-control ${el.passwords_mismatched ? 'error' : ''}"
                type="password"
                value=""
                name="password"
                required="required"
                id="converse_password_reset_new"
                autocomplete="new-password"
                minlength="8"
                ?disabled="${el.alert_message}"
            />
        </div>
        <div class="form-group">
            <label for="converse_password_reset_check">${i18n_confirm_password}</label>
            <input
                class="form-control ${el.passwords_mismatched ? 'error' : ''}"
                type="password"
                value=""
                name="password_check"
                required="required"
                id="converse_password_reset_check"
                autocomplete="new-password"
                minlength="8"
                ?disabled="${el.alert_message}"
                @input=${ev => el.checkPasswordsMatch(ev)}
            />
            ${el.passwords_mismatched ? html`<span class="error">${i18n_passwords_must_match}</span>` : ''}
        </div>

        <input class="save-form btn btn-primary"
               type="submit"
               value=${i18n_submit}
               ?disabled="${el.alert_message}" />
    </form>`;
};
