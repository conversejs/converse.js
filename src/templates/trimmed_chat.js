import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';


const i18n_tooltip = __('Click to restore this chat');


export default (o) => html`
    <div class="chat-head-${o.type} chat-head row no-gutters">
        <a class="restore-chat w-100 align-self-center" title="${i18n_tooltip}">
            ${o.num_unread ? html`<span class="message-count badge badge-light">${o.num_unread}</span>` : '' }
            ${o.title}
        </a>
        <a class="chatbox-btn close-chatbox-button fa fa-times"></a>
    </div>`;
