import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { modal_header_close_button } from "./buttons"

const i18n_contact_placeholder = __('name@example.org');
const i18n_add = __('Add');
const i18n_error_message = __('Please enter a valid XMPP address');
const i18n_new_contact = __('Add a Contact');
const i18n_xmpp_address = __('XMPP Address');
const i18n_nickname = __('Nickname');


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addContactModalLabel">${i18n_new_contact}</h5>
                ${modal_header_close_button}
            </div>
            <form class="converse-form add-xmpp-contact">
                <div class="modal-body">
                    <span class="modal-alert"></span>
                    <div class="form-group add-xmpp-contact__jid">
                        <label class="clearfix" for="jid">${i18n_xmpp_address}:</label>
                        <div class="suggestion-box suggestion-box__jid">
                            <ul class="suggestion-box__results suggestion-box__results--above" hidden=""></ul>
                            <input type="text" name="jid" ?required=${(!o._converse.xhr_user_search_url)}
                                value="${o.jid || ''}"
                                class="form-control suggestion-box__input"
                                placeholder="${i18n_contact_placeholder}"/>
                            <span class="suggestion-box__additions visually-hidden" role="status" aria-live="assertive" aria-relevant="additions"></span>
                        </div>
                    </div>
                    <div class="form-group add-xmpp-contact__name">
                        <label class="clearfix" for="name">${i18n_nickname}:</label>
                        <div class="suggestion-box suggestion-box__name">
                            <ul class="suggestion-box__results suggestion-box__results--above" hidden=""></ul>
                            <input type="text" name="name" value="${o.nickname || ''}"
                                class="form-control suggestion-box__input"
                                placeholder="${i18n_nickname}"/>
                            <span class="suggestion-box__additions visually-hidden" role="status" aria-live="assertive" aria-relevant="additions"></span>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="invalid-feedback">${i18n_error_message}</div>
                    </div>
                    <button type="submit" class="btn btn-primary">${i18n_add}</button>
                </div>
            </form>
        </div>
    </div>
`;
