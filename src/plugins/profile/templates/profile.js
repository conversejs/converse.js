import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from "lit";


function tpl_signout (o) {
    const i18n_logout = __('Log out');
    return html`<a class="controlbox-heading__btn logout align-self-center" title="${i18n_logout}" @click=${o.logout}>
        <converse-icon color="var(--subdued-color)" class="fa fa-sign-out-alt" size="1em"></converse-icon>
    </a>`
}

function tpl_user_settings_button (o) {
    const i18n_details = __('Show details about this chat client');
    return html`<a class="controlbox-heading__btn show-client-info align-self-center" title="${i18n_details}" @click=${o.showUserSettingsModal}>
        <converse-icon color="var(--subdued-color)" class="fa fa-cog" size="1em"></converse-icon>
    </a>`;
}

export default (o) => {
    const i18n_change_status = __('Click to change your chat status');
    const show_settings_button = api.settings.get('show_client_info') || api.settings.get('allow_adhoc_commands');
    let classes, color;
    if (o.chat_status === 'online') {
        [classes, color] = ['fa fa-circle chat-status', 'chat-status-online'];
    } else if (o.chat_status === 'dnd') {
        [classes, color] =  ['fa fa-minus-circle chat-status', 'chat-status-busy'];
    } else if (o.chat_status === 'away') {
        [classes, color] =  ['fa fa-circle chat-status', 'chat-status-away'];
    } else {
        [classes, color] = ['fa fa-circle chat-status', 'subdued-color'];
    }
    return html`
        <div class="userinfo controlbox-padded">
            <div class="controlbox-section profile d-flex">
                <a class="show-profile" href="#" @click=${o.showProfileModal}>
                    <canvas class="avatar align-self-center" height="40" width="40"></canvas>
                </a>
                <span class="username w-100 align-self-center">${o.fullname}</span>
                ${show_settings_button  ? tpl_user_settings_button(o) : ''}
                ${api.settings.get('allow_logout') ? tpl_signout(o) : ''}
            </div>
            <div class="d-flex xmpp-status">
                <a class="change-status" title="${i18n_change_status}" data-toggle="modal" data-target="#changeStatusModal" @click=${o.showStatusChangeModal}>
                    <span class="${o.chat_status} w-100 align-self-center" data-value="${o.chat_status}">
                    <converse-icon color="var(--${color})" size="1em" class="${classes}"></converse-icon> ${o.status_message}</span>
                </a>
            </div>
        </div>`
};
