import '../message-form.js';
import '../nickname-form.js';
import 'shared/chat/toolbar.js';
import { __ } from 'i18n';
import { api, converse } from "@converse/headless/core";
import { html } from "lit";


const tpl_can_edit = (o) => {
    const unread_msgs = __('You have unread messages');
    const message_limit = api.settings.get('message_limit');
    const show_call_button = api.settings.get('visible_toolbar_buttons').call;
    const show_emoji_button = api.settings.get('visible_toolbar_buttons').emoji;
    const show_send_button = api.settings.get('show_send_button');
    const show_spoiler_button = api.settings.get('visible_toolbar_buttons').spoiler;
    const show_toolbar = api.settings.get('show_toolbar');
    return html`
        ${ (o.model.ui.get('scrolled') && o.model.get('num_unread')) ?
                html`<div class="new-msgs-indicator" @click=${ev => o.viewUnreadMessages(ev)}>▼ ${ unread_msgs } ▼</div>` : '' }
        ${show_toolbar ? html`
            <converse-chat-toolbar
                class="chat-toolbar no-text-select"
                .model=${o.model}
                ?hidden_occupants="${o.model.get('hidden_occupants')}"
                ?is_groupchat="${o.is_groupchat}"
                ?show_call_button="${show_call_button}"
                ?show_emoji_button="${show_emoji_button}"
                ?show_send_button="${show_send_button}"
                ?show_spoiler_button="${show_spoiler_button}"
                ?show_toolbar="${show_toolbar}"
                message_limit="${message_limit}"></converse-chat-toolbar>` : '' }
        <converse-muc-message-form jid=${o.model.get('jid')}></converse-muc-message-form>`;
}


export default (o) => {
    const unread_msgs = __('You have unread messages');
    const conn_status = o.model.session.get('connection_status');
    const i18n_not_allowed = __("You're not allowed to send messages in this room");
    if (conn_status === converse.ROOMSTATUS.ENTERED) {
        return html`
            ${ o.model.ui.get('scrolled') && o.model.get('num_unread_general') ?
                    html`<div class="new-msgs-indicator" @click=${ev => o.viewUnreadMessages(ev)}>▼ ${ unread_msgs } ▼</div>` : '' }
            ${(o.can_edit) ? tpl_can_edit(o) : html`<span class="muc-bottom-panel muc-bottom-panel--muted">${i18n_not_allowed}</span>`}`;
    } else if (conn_status == converse.ROOMSTATUS.NICKNAME_REQUIRED) {
        if (api.settings.get('muc_show_logs_before_join')) {
            return html`<span class="muc-bottom-panel muc-bottom-panel--nickname">
                <converse-muc-nickname-form jid="${o.model.get('jid')}"></converse-muc-nickname-form>
            </span>`;
        }
    } else {
        return '';
    }
}
