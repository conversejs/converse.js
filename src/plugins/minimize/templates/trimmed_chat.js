import { html } from "lit";
import { __ } from 'i18n';


/**
 * @param {import('../minimized-chat').default} el
 */
export default (el) => {
    const i18n_tooltip = __('Click to restore this chat');
    let close_color;
    if (el.type === 'chatroom') {
        close_color = "var(--muc-color)";
    } else if (el.type === 'headline') {
        close_color = "var(--headlines-color)";
    } else {
        close_color = "var(--chat-color)";
    }

    return html`
    <div class="chat-head-${el.type} chat-head row g-0">
        <a class="col-10 restore-chat align-self-center" title="${i18n_tooltip}" @click=${ev => el.restore(ev)}>
            ${el.num_unread ? html`<span class="message-count badge badge-light">${el.num_unread}</span>` : '' }
            ${el.title}
        </a>
        <a class="col-2 pl-1" @click=${ev => el.close(ev)}>
            <converse-icon color=${close_color} class="fas fa-times" @click=${ev => el.close(ev)} size="1em"></converse-icon>
        </a>
    </div>`;
}
