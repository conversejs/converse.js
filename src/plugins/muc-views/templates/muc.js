import '../chatarea.js';
import '../destroyed.js';
import '../disconnected.js';
import '../heading.js';
import '../nickname-form.js';
import '../password-form.js';
import { html } from "lit";
import { getChatRoomBodyTemplate } from '../utils.js';


/**
 * @param {import('../muc').default} el
 */
export default (el) => {
    return html`
        <div class="flyout box-flyout">
            <converse-dragresize></converse-dragresize>
            ${ el.model ? html`
                <converse-muc-heading jid="${el.model.get('jid')}" class="chat-head chat-head-chatroom row g-0">
                </converse-muc-heading>
                <div class="chat-body chatroom-body row g-0">${getChatRoomBodyTemplate(el.model)}</div>
            ` : '' }
        </div>`;
}
