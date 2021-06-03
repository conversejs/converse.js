import '../heading.js';
import { html } from "lit";

export default (o) => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        <converse-headlines-heading jid="${o.jid}" class="chat-head chat-head-chatbox row no-gutters"></converse-headlines-heading>
        <div class="chat-body">
            <div class="chat-content ${ o.show_send_button ? 'chat-content-sendbutton' : '' }" aria-live="polite">
                <converse-chat-content
                    class="chat-content__messages"
                    jid="${o.jid}"></converse-chat-content>

                <div class="chat-content__help"></div>
            </div>
        </div>
    </div>
`;
