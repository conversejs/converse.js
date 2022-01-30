import 'shared/avatar/avatar.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { getPrettyStatus } from '../utils.js';
import { html } from "lit";


function tpl_signout (o) {
    const i18n_logout = __('Log out');
    return html`<a class="controlbox-heading__btn logout align-self-center" title="${i18n_logout}" @click=${o.logout}>
        <converse-icon class="fa fa-sign-out-alt" size="1em"></converse-icon>
    </a>`
}

function tpl_user_settings_button (o) {
    const i18n_details = __('Show details about this chat client');
    return html`<a class="controlbox-heading__btn show-client-info align-self-center" title="${i18n_details}" @click=${o.showUserSettingsModal}>
        <converse-icon class="fa fa-cog" size="1em"></converse-icon>
    </a>`;
}

export default (el) => {
    const chat_status = el.model.get('status') || 'offline';
    const fullname = el.model.vcard?.get('fullname') || _converse.bare_jid;
    const status_message = el.model.get('status_message') || __("I am %1$s", getPrettyStatus(chat_status));
    const i18n_change_status = __('Click to change your chat status');
    const show_settings_button = api.settings.get('show_client_info') || api.settings.get('allow_adhoc_commands');
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
        <div class="userinfo controlbox-padded">
            <div class="controlbox-section profile d-flex">
                <a class="show-profile" href="#" @click=${el.showProfileModal}>
                    <converse-avatar class="avatar align-self-center"
                        .data=${el.model.vcard?.attributes}
                        nonce=${el.model.vcard?.get('vcard_updated')}
                        height="40" width="40"></converse-avatar>
                </a>
                <span class="username w-100 align-self-center">${fullname}</span>
                ${show_settings_button  ? tpl_user_settings_button(el) : ''}
                ${api.settings.get('allow_logout') ? tpl_signout(el) : ''}
            </div>
            <div class="d-flex xmpp-status">
                <a class="change-status" title="${i18n_change_status}" data-toggle="modal" data-target="#changeStatusModal" @click=${el.showStatusChangeModal}>
                    <span class="${chat_status} w-100 align-self-center" data-value="${chat_status}">
                    <converse-icon color="var(--${color})" style="margin-top: -0.1em" size="0.82em" class="${classes}"></converse-icon> ${status_message}</span>
                </a>
            </div>
        </div>`
};
