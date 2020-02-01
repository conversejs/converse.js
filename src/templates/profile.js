import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';


const i18n_logout = __('Log out');
const i18n_change_status = __('Click to change your chat status');
const i18n_details = __('Show details about this chat client');


export default (o) => html`
    <div class="userinfo controlbox-padded">
        <div class="controlbox-section profile d-flex">
            <a class="show-profile" href="#">
                <canvas class="avatar align-self-center" height="40" width="40"></canvas>
            </a>
            <span class="username w-100 align-self-center">${o.fullname}</span>
            ${o._converse.show_client_info && html`<a class="controlbox-heading__btn show-client-info fa fa-info-circle align-self-center" title="${i18n_details}"></a>`}
            ${o._converse.allow_logout && html`<a class="controlbox-heading__btn logout fa fa-sign-out-alt align-self-center" title="${i18n_logout}"></a>`}
        </div>
        <div class="d-flex xmpp-status">
            <a class="change-status" title="${i18n_change_status}" data-toggle="modal" data-target="#changeStatusModal">
                <span class="${o.chat_status} w-100 align-self-center" data-value="${o.chat_status}">
                    <span class="
                        ${o.chat_status === 'online' && 'fa fa-circle chat-status chat-status--online'}
                        ${o.chat_status === 'dnd' && 'fa fa-minus-circle chat-status chat-status--busy'}
                        ${o.chat_status === 'away' && 'fa fa-circle chat-status chat-status--away'}
                        ${o.chat_status === 'xa' && 'far fa-circle chat-status chat-status--xa '}
                        ${o.chat_status === 'offline' && 'fa fa-circle chat-status chat-status--offline'}"></span> ${o.status_message}</span>
            </a>
        </div>
    </div>
`;
