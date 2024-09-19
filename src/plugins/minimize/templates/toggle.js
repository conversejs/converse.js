import { html } from "lit";
import { __ } from 'i18n';

/**
 * @param {import('../view').default} el
 */
export default (el) => {
    const chats = el.model.where({'hidden': true});
    const num_unread = chats.reduce((acc, chat) => (acc + chat.get('num_unread')), 0);
    const num_minimized = chats.reduce((acc, chat) => (acc + (chat.get('hidden') ? 1 : 0)), 0);
    const collapsed = el.minchats.get('collapsed');

    return html`<div id="minimized-chats" class="${chats.length ? '' : 'hidden'}">
        <button type="button" class="btn btn-primary" @click=${(ev) => el.toggle(ev)}>
            ${num_minimized} ${__('hidden')}
            <span class="badge bg-secondary unread-message-count ${!num_unread ? 'hidden' : ''}">${num_unread}</span>
        </button>
        <div class="flyout minimized-chats-flyout row g-0 ${collapsed ? 'hidden' : ''}">
            ${chats.map(chat =>
                html`<converse-minimized-chat
                        .model=${chat}
                        title=${chat.getDisplayName()}
                        type=${chat.get('type')}
                        num_unread=${chat.get('num_unread')}></converse-minimized-chat>`)}
        </div>
    </div>`;
}
