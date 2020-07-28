import { html } from "lit-html";
import { api } from '@converse/headless/converse-core.js';

export default (o) => {
    const message_limit = api.settings.get('message_limit');
    const show_call_button = api.settings.get('visible_toolbar_buttons').call;
    const show_emoji_button = api.settings.get('visible_toolbar_buttons').emoji;
    const show_send_button = api.settings.get('show_send_button');
    const show_spoiler_button = api.settings.get('visible_toolbar_buttons').spoiler;
    const show_toolbar = api.settings.get('show_toolbar');
    return html`
        <converse-chat-toolbar
            .chatview=${o.chatview}
            .model=${o.model}
            ?composing_spoiler="${o.composing_spoiler}"
            ?hidden_occupants="${o.hidden_occupants}"
            ?is_groupchat="${o.is_groupchat}"
            ?show_call_button="${show_call_button}"
            ?show_emoji_button="${show_emoji_button}"
            ?show_occupants_toggle="${o.show_occupants_toggle}"
            ?show_send_button="${show_send_button}"
            ?show_spoiler_button="${show_spoiler_button}"
            ?show_toolbar="${show_toolbar}"
            message_limit="${message_limit}"
        ></converse-chat-toolbar>
    `;
}
