import { __ } from '../i18n';
import { html } from "lit-html";


const tpl_can_edit = () => html`
    <div class="emoji-picker__container dropup"></div>
    <div class="message-form-container">`;


export default (o) => {
    const i18n_not_allowed = __("You're not allowed to send messages in this room");
    if (o.entered) {
        return (o.can_edit) ? tpl_can_edit() : html`<div class="muc-bottom-panel">${i18n_not_allowed}</div>`;
    } else {
        return html`<div class="muc-bottom-panel"></div>`;
    }
}
