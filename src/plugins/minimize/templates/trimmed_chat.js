import { html } from "lit";
import { __ } from 'i18n';


export default (o) => {
    const i18n_tooltip = __('Click to restore this chat');
    let close_color;
    if (o.type === 'chatroom') {
        close_color = "var(--chatroom-head-color)";
    } else if (o.type === 'headline') {
        close_color = "var(--headline-head-text-color)";
    } else {
        close_color = "var(--chat-head-text-color)";
    }

    return html`
    <div class="chat-head-${o.type} chat-head row no-gutters">
        <a class="restore-chat w-100 align-self-center" title="${i18n_tooltip}" @click=${o.restore}>
            ${o.num_unread ? html`<span class="message-count badge badge-light">${o.num_unread}</span>` : '' }
            ${o.title}
        </a>
        <a class="chatbox-btn close-chatbox-button" @click=${o.close}>
            <converse-icon color=${close_color} class="fas fa-times" @click=${o.close} size="1em"></converse-icon>
        </a>
    </div>`;
}
