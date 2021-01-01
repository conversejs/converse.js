import { html } from "lit-html";
import { api } from "@converse/headless/core";
import { __ } from 'i18n';

export default  () => {
    const i18n_toggle = api.connection.connected() ? __('Chat Contacts') : __('Toggle chat');
    return html`<span class="toggle-feedback">${i18n_toggle}</span>`;
}
