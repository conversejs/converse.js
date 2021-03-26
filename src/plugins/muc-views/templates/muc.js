import '../chatarea.js';
import '../config-form.js';
import '../destroyed.js';
import '../disconnected.js';
import '../heading.js';
import '../nickname-form.js';
import '../password-form.js';
import tpl_spinner from 'templates/spinner.js';
import { converse } from "@converse/headless/core";
import { html } from "lit-html";


function getChatRoomBody (o) {
    const view = o.model.session.get('view');
    const jid = o.model.get('jid');
    const RS = converse.ROOMSTATUS;
    const conn_status =  o.model.session.get('connection_status');

    if (view === converse.MUC.VIEWS.CONFIG) {
        return html`<converse-muc-config-form class="muc-form-container" jid="${jid}"></converse-muc-config-form>`;
    } else if (view === converse.MUC.VIEWS.BOOKMARK) {
        return html`<converse-muc-bookmark-form class="muc-form-container" jid="${jid}"></converse-muc-bookmark-form>`;
    } else {
        return html`
            ${ conn_status == RS.PASSWORD_REQUIRED ? html`<converse-muc-password-form class="muc-form-container" jid="${jid}"></converse-muc-password-form>` : '' }
            ${ conn_status == RS.ENTERED ? html`<converse-muc-chatarea jid="${jid}"></converse-muc-chatarea>` : '' }
            ${ conn_status == RS.CONNECTING ? tpl_spinner() : '' }
            ${ conn_status == RS.NICKNAME_REQUIRED ? o.getNicknameRequiredTemplate() : '' }
            ${ conn_status == RS.DISCONNECTED ? html`<converse-muc-disconnected jid="${jid}"></converse-muc-disconnected>` : '' }
            ${ conn_status == RS.DESTROYED ? html`<converse-muc-destroyed jid="${jid}"></converse-muc-destroyed>` : '' }
        `;
    }
}

export default (o) => {
    return html`
        <div class="flyout box-flyout">
            <converse-dragresize></converse-dragresize>
            <converse-muc-heading jid="${o.model.get('jid')}" class="chat-head chat-head-chatroom row no-gutters"></converse-muc-heading>
            <div class="chat-body chatroom-body row no-gutters">${getChatRoomBody(o)}</div>
        </div>
    `;
}
