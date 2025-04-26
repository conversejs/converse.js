import { html } from "lit";
import { __ } from 'i18n';

export default (el) => {
    const i18n_invite = __('Invite');
    const i18n_jid_placeholder = __('user@example.org');
    const i18n_error_message = __('Please enter a valid XMPP address');
    const i18n_invite_label = __('XMPP Address');
    const i18n_reason = __('Optional reason for the invitation');
    return html`
        <form class="converse-form" @submit=${(ev) => el.submitInviteForm(ev)}>
            <fieldset>
                <label class="form-label clearfix" for="invitee_jids">${i18n_invite_label}:</label>
                ${ el.model.get('invalid_invite_jid') ? html`<div class="error error-feedback">${i18n_error_message}</div>` : '' }
                <converse-autocomplete
                    .getAutoCompleteList="${() => el.getAutoCompleteList()}"
                    ?autofocus=${true}
                    min_chars="1"
                    position="below"
                    required="required"
                    name="invitee_jids"
                    id="invitee_jids"
                    placeholder="${i18n_jid_placeholder}">
                </converse-autocomplete>
            </fieldset>

            <fieldset>
                <label class="form-label">${i18n_reason}:</label>
                <textarea class="form-control" name="reason"></textarea>
            </fieldset>

            <fieldset>
                <input type="submit" class="btn btn-primary" value="${i18n_invite}"/>
            </fieldset>
        </form>
    `;
}
