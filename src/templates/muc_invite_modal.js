import { html } from "lit-html";
import { __ } from '../i18n';
import { modal_header_close_button } from "./buttons"


export default (o) => {
    const i18n_invite = __('Invite');
    const i18n_invite_heading = __('Invite someone to this groupchat');
    const i18n_jid_placeholder = __('user@example.org');
    const i18n_error_message = __('Please enter a valid XMPP address');
    const i18n_invite_label = __('XMPP Address');
    const i18n_reason = __('Optional reason for the invitation');
    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="add-chatroom-modal-label">${i18n_invite_heading}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    <span class="modal-alert"></span>
                    <div class="suggestion-box room-invite">
                        <form @submit=${o.submitInviteForm}>
                            <div class="form-group">
                                <label class="clearfix" for="invitee_jids">${i18n_invite_label}:</label>
                                ${ o.invalid_invite_jid ? html`<div class="error error-feedback">${i18n_error_message}</div>` : '' }
                                <input class="form-control suggestion-box__input"
                                    required="required"
                                    name="invitee_jids"
                                    id="invitee_jids"
                                    placeholder="${i18n_jid_placeholder}"
                                    type="text"/>
                                <span class="suggestion-box__additions visually-hidden" role="status" aria-live="assertive" aria-relevant="additions"></span>
                                <ul class="suggestion-box__results suggestion-box__results--below" hidden=""></ul>
                            </div>
                            <div class="form-group">
                                <label>${i18n_reason}:</label>
                                <textarea class="form-control" name="reason"></textarea>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn btn-primary">${i18n_invite}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
}
