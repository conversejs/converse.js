import '../bottom-panel.js';
import '../sidebar.js';
import 'shared/chat/chat-content.js';
import 'shared/chat/help-messages.js';
import { _converse } from '@converse/headless/core';
import { html } from "lit";

export default (o) => html`
    <div class="chat-area">
        <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
            <converse-chat-content
                class="chat-content__messages"
                jid="${o.jid}"></converse-chat-content>

            ${(o.model?.get('show_help_messages')) ?
                html`<div class="chat-content__help">
                    <converse-chat-help
                        .model=${o.model}
                        .messages=${o.getHelpMessages()}
                        type="info"
                        chat_type="${_converse.CHATROOMS_TYPE}"
                    ></converse-chat-help></div>` : '' }
        </div>
        <converse-muc-bottom-panel jid="${o.jid}" class="bottom-panel"></converse-muc-bottom-panel>
    </div>
    <div class="disconnect-container hidden"></div>
    ${o.model ? html`
        <converse-muc-sidebar
            class="occupants col-md-3 col-4 ${o.shouldShowSidebar() ? '' : 'hidden' }"
            style="flex: 0 0 ${o.model.get('occupants_width')}px"
            jid=${o.jid}
            @mousedown=${o.onMousedown}></converse-muc-sidebar>` : '' }
`;
