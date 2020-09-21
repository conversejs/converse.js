import { html } from "lit-html";
import { __ } from '../i18n';


export default (o) => {
    const i18n_tooltip = __('Click to restore this chat');
    return html`
        <div class="chat-head-${o.type} chat-head row no-gutters">
            <a class="restore-chat w-100 align-self-center" title="${i18n_tooltip}" @click=${o.restore}>
                ${o.num_unread ? html`<span class="message-count badge badge-light">${o.num_unread}</span>` : '' }
                ${o.title}
            </a>
            <a class="chatbox-btn close-chatbox-button fa fa-times" @click=${o.close}></a>
        </div>`;
}
