import { __ } from 'i18n';
import { api } from '@converse/headless/core';
import { html } from 'lit';


export default (o) => {
    const unread_msgs = __('You have unread messages');
    const message_limit = api.settings.get('message_limit');
    const show_call_button = api.settings.get('visible_toolbar_buttons').call;
    const show_emoji_button = api.settings.get('visible_toolbar_buttons').emoji;
    const show_send_button = api.settings.get('show_send_button');
    const show_spoiler_button = api.settings.get('visible_toolbar_buttons').spoiler;
    const show_toolbar = api.settings.get('show_toolbar');
    return html`
        ${ o.model.ui.get('scrolled') && o.model.get('num_unread') ?
                html`<div class="new-msgs-indicator" @click=${ev => o.viewUnreadMessages(ev)}>▼ ${ unread_msgs } ▼</div>` : '' }
        ${api.settings.get('show_toolbar') ? html`
            <converse-chat-toolbar
                class="chat-toolbar no-text-select"
                .model=${o.model}
                ?composing_spoiler="${o.model.get('composing_spoiler')}"
                ?show_call_button="${show_call_button}"
                ?show_emoji_button="${show_emoji_button}"
                ?show_send_button="${show_send_button}"
                ?show_spoiler_button="${show_spoiler_button}"
                ?show_toolbar="${show_toolbar}"
                message_limit="${message_limit}"></converse-chat-toolbar>` : '' }
        <converse-message-form jid="${o.model.get('jid')}"></converse-message-form>
    `;
}
