import '../bottom_panel.js';
import '../heading.js';
import '../sidebar.js';
import { html } from "lit-html";

export default (o) => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        <converse-muc-heading jid="${o.model.get('jid')}" class="chat-head chat-head-chatroom row no-gutters"></converse-muc-heading>
        <div class="chat-body chatroom-body row no-gutters">
            <div class="chat-area col">
                <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
                    <converse-chat-content
                        class="chat-content__messages"
                        jid="${o.model.get('jid')}"
                        @scroll=${o.markScrolled}></converse-chat-content>

                    <div class="chat-content__help"></div>
                </div>
                <converse-muc-bottom-panel jid="${o.model.get('jid')}" class="bottom-panel"></converse-muc-bottom-panel>
            </div>
            <div class="disconnect-container hidden"></div>
            <converse-muc-sidebar class="occupants col-md-3 col-4 ${o.sidebar_hidden ? 'hidden' : ''}"
                .occupants=${o.occupants}
                .chatroom=${o.model}></converse-muc-sidebar>
            <div class="nickname-form-container"></div>
        </div>
    </div>
`;
