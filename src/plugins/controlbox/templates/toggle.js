import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from "lit";

export default  (o) => {
    const i18n_toggle = api.connection.connected() ? __('Chat Contacts') : __('Toggle chat');
    return html`<a id="toggle-controlbox" class="toggle-controlbox ${o.hide ? 'hidden' : ''}" @click=${o.onClick}><span class="toggle-feedback">${i18n_toggle}</span></a>`;
}
