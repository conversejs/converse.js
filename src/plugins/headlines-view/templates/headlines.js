import '../heading.js';
import { html } from "lit";

export default (model) => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        ${ model ? html`
            <converse-headlines-heading jid="${model.get('jid')}" class="chat-head chat-head-chatbox row no-gutters">
            </converse-headlines-heading>
            <div class="chat-body">
                <div class="chat-content" aria-live="polite">
                    <converse-chat-content
                        class="chat-content__messages"
                        jid="${model.get('jid')}"></converse-chat-content>
                </div>
            </div>` : '' }
    </div>
`;
