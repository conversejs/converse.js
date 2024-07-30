import { api } from '@converse/headless';
import { html } from "lit";
import { getChatRoomBodyTemplate } from '../utils.js';
import '../chatarea.js';
import '../destroyed.js';
import '../disconnected.js';
import '../heading.js';
import '../nickname-form.js';
import '../password-form.js';


export default (o) => {
    return html`
        <div class="flyout box-flyout">
            ${ api.settings.get('view_mode') === 'overlayed' ? html`<converse-dragresize></converse-dragresize>` : '' }
            ${ o.model ? html`
                <converse-muc-heading jid="${o.model.get('jid')}" class="chat-head chat-head-chatroom row g-0"></converse-muc-heading>
                <div class="chat-body chatroom-body row g-0">${getChatRoomBodyTemplate(o)}</div>` : '' }
        </div>`;
}
