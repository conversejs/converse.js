import { html } from "lit-html";

export default (o) => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        <converse-chat-heading jid="${o.jid}" class="chat-head chat-head-chatbox row no-gutters"></converse-chat-heading>
        <div class="chat-body">
            <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
                <converse-chat-content
                    class="chat-content__messages"
                    jid="${o.jid}"
                    @scroll=${o.markScrolled}></converse-chat-content>

                <div class="chat-content__help"></div>
            </div>
            <converse-chat-bottom-panel jid="${o.jid}" class="bottom-panel"> </converse-chat-bottom-panel>
        </div>
    </div>
`;
