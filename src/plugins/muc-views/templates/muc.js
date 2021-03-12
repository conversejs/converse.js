import '../chatarea.js';
import '../bottom-panel.js';
import '../heading.js';
import '../sidebar.js';
import { html } from "lit-html";

export default (o) => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        <converse-muc-heading jid="${o.model.get('jid')}" class="chat-head chat-head-chatroom row no-gutters"></converse-muc-heading>
        <div class="chat-body chatroom-body row no-gutters">
            <converse-muc-chatarea jid="${o.model.get('jid')}"></converse-muc-chatarea>
        </div>
    </div>
`;
