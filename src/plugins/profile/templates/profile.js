import { html } from "lit";
import 'shared/avatar/avatar.js';
import { __ } from 'i18n';
import { getPrettyStatus } from '../utils.js';


/**
 * @param {import('../statusview').default} el
 */
export default (el) => {
    const chat_status = el.model.get('status') || 'offline';
    const status_message = el.model.get('status_message') || __("I am %1$s", getPrettyStatus(chat_status));
    const i18n_change_status = __('Click to change your chat status');
    let classes, color;
    if (chat_status === 'online') {
        [classes, color] = ['fa fa-circle chat-status', 'chat-status-online'];
    } else if (chat_status === 'dnd') {
        [classes, color] =  ['fa fa-minus-circle chat-status', 'chat-status-busy'];
    } else if (chat_status === 'away') {
        [classes, color] =  ['fa fa-circle chat-status', 'chat-status-away'];
    } else {
        [classes, color] = ['fa fa-circle chat-status', 'subdued-color'];
    }
    return html`
        <div class="userinfo">
            <div class="controlbox-section profile d-flex">
                <a class="show-profile" href="#" @click=${el.showProfileModal}>
                    <converse-avatar class="avatar align-self-center"
                        .model=${el.model}
                        name="${el.model.getDisplayName()}"
                        nonce=${el.model.vcard?.get('vcard_updated')}
                        height="40" width="40"></converse-avatar>
                </a>
                <span class="username w-100 align-self-center" role="heading" aria-level="2">
                    ${el.model.getDisplayName()}
                </span>
                <converse-controlbox-buttons></converse-controlbox-buttons>
            </div>
            <div class="d-flex xmpp-status">
                <a class="change-status"
                   title="${i18n_change_status}"
                   data-toggle="modal"
                   data-target="#changeStatusModal"
                   @click=${el.showStatusChangeModal}>

                    <span class="${chat_status} w-100 align-self-center" data-value="${chat_status}">
                        <converse-icon
                                color="var(--${color})"
                                css="margin-top: -0.1em"
                                size="0.82em"
                                class="${classes}"></converse-icon> ${status_message}</span>
                </a>
            </div>
        </div>`
};
