import { html } from "lit-html";
import { _converse } from '@converse/headless/core';

export default (o) => html`
    <div class="chat-area">
        <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
            <converse-chat-content
                class="chat-content__messages"
                jid="${o.jid}"
                @scroll=${o.markScrolled}></converse-chat-content>

            ${o.show_help_messages ? html`<div class="chat-content__help">
                    <converse-chat-help
                        .model=${o.model}
                        .messages=${o.help_messages}
                        ?hidden=${!o.show_help_messages}
                        type="info"
                        chat_type="${_converse.CHATROOMS_TYPE}"
                    ></converse-chat-help></div>` : '' }
        </div>
        <converse-muc-bottom-panel jid="${o.jid}" class="bottom-panel"></converse-muc-bottom-panel>
    </div>
    <div class="disconnect-container hidden"></div>
    <converse-muc-sidebar class="occupants col-md-3 col-4 ${o.show_sidebar ? '' : 'hidden' }"
        .occupants=${o.occupants}
        .chatroom=${o.model}></converse-muc-sidebar>
`;
