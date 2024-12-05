import '../message-form.js';
import '../nickname-form.js';
import 'shared/chat/toolbar.js';
import { __ } from 'i18n';
import { converse } from '@converse/headless';
import { html } from 'lit';

/**
 * @param {import('../occupant-bottom-panel').default} el
 */
export default (el) => {
    const unread_msgs = __('You have unread messages');
    const conn_status = el.muc.session.get('connection_status');
    const i18n_not_allowed = __("This user is not currently in this groupchat and can't receive messages.");
    const i18n_invite_tooltip = __('Invite this user to join this groupchat');
    const i18n_open_chat_tooltip = __('Open a one-on-one chat with this user');
    const i18n_open_chat = __('Open Chat');
    const i18n_invite = __('Invite');
    if (conn_status === converse.ROOMSTATUS.ENTERED) {
        return html`${el.muc.ui.get('scrolled') && el.model.get('num_unread')
            ? html`<div class="new-msgs-indicator" @click=${(ev) => el.viewUnreadMessages(ev)}>▼ ${unread_msgs} ▼</div>`
            : ''}
        ${el.canPostMessages()
            ? html`<converse-muc-message-form .model=${el.model}></converse-muc-message-form>`
            : html`<div class="bottom-panel bottom-panel--muted">
                  <p class="bottom-panel--muted__msg">${i18n_not_allowed}</p>
                  ${el.model.get('jid')
                      ? html` <button
                                @click=${el.openChat}
                                type="button"
                                class="btn btn-primary"
                                title="${i18n_open_chat_tooltip}"
                            >
                                ${i18n_open_chat}
                            </button>
                            <button
                                @click=${el.invite}
                                type="button"
                                class="btn btn-secondary"
                                title="${i18n_invite_tooltip}"
                            >
                                ${i18n_invite}
                            </button>`
                      : ''}
              </div>`}`;
    } else {
        return '';
    }
};
