import '../message-form.js';
import '../nickname-form.js';
import 'shared/chat/toolbar.js';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless';
import { html } from 'lit';

/**
 * @param {import('../bottom-panel').default} el
 */
const tpl_can_post = (el) => {
    const unread_msgs = __('You have unread messages');
    return html` ${el.model.ui.get('scrolled') && el.model.get('num_unread')
            ? html`<div class="new-msgs-indicator" @click=${(ev) => el.viewUnreadMessages(ev)}>▼ ${unread_msgs} ▼</div>`
            : ''}
        <converse-muc-message-form .model=${el.model}></converse-muc-message-form>`;
};

/**
 * @param {import('../bottom-panel').default} el
 */
export default (el) => {
    const unread_msgs = __('You have unread messages');
    const conn_status = el.model.session.get('connection_status');
    const i18n_not_allowed = __("You're not allowed to send messages in this room");
    if (conn_status === converse.ROOMSTATUS.ENTERED) {
        return html` ${el.model.ui.get('scrolled') && el.model.get('num_unread_general')
            ? html`<div class="new-msgs-indicator" @click=${(ev) => el.viewUnreadMessages(ev)}>▼ ${unread_msgs} ▼</div>`
            : ''}
        ${el.model.canPostMessages()
            ? tpl_can_post(el)
            : html`<span class="muc-bottom-panel muc-bottom-panel--muted">${i18n_not_allowed}</span>`}`;
    } else if (conn_status == converse.ROOMSTATUS.NICKNAME_REQUIRED) {
        if (api.settings.get('muc_show_logs_before_join')) {
            return html`<span class="muc-bottom-panel muc-bottom-panel--nickname">
                <converse-muc-nickname-form .model=${el.model}></converse-muc-nickname-form>
            </span>`;
        }
    } else {
        return '';
    }
};
