import tpl_muc_nickname_form from './muc_nickname_form.js';
import { __ } from 'i18n';
import { api, converse } from "@converse/headless/core";
import { html } from "lit-html";


const tpl_can_edit = () => html`
    <div class="emoji-picker__container dropup"></div>
    <div class="message-form-container">`;


export default (o) => {
    const conn_status = o.model.session.get('connection_status');
    const i18n_not_allowed = __("You're not allowed to send messages in this room");
    if (conn_status === converse.ROOMSTATUS.ENTERED) {
        return (o.can_edit) ? tpl_can_edit() : html`<span class="muc-bottom-panel muc-bottom-panel--muted">${i18n_not_allowed}</span>`;
    } else if (conn_status == converse.ROOMSTATUS.NICKNAME_REQUIRED) {
        if (api.settings.get('muc_show_logs_before_join')) {
            return html`<span class="muc-bottom-panel muc-bottom-panel--nickname">${tpl_muc_nickname_form(o.model.toJSON())}</span>`;
        }
    } else {
        return '';
    }
}
