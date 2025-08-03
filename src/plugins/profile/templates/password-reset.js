import { __ } from 'i18n';
import { html } from 'lit';

export default el => {

      if (el._converse?.authentication === 'external') {
        return html``;
    }
    const i18n_submit = __('Submit');
    const i18n_passwords_must_match = __('The new passwords must match');
    const i18n_new_password = __('New password');
    const i18n_confirm_password = __('Confirm new password');

    return html`<form class="converse-form passwordreset-form" method="POST" @submit=${ev => el.onSubmit(ev)}>
        ${el.alert_message ? html`<div class="alert alert-danger" role="alert">${el.alert_message}</div>` : ''}

        <div class="py-2">
            <label for="converse_password_reset_new" class="form-label">${i18n_new_password}</label>
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

        <div class="py-2">
            <label for="converse_password_reset_check" class="form-label">${i18n_confirm_password}</label>
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
