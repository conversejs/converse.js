import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from "lit-html";

const tpl_pending_contact = o => html`<span class="pending-contact-name" title="JID: ${o.jid}">${o.display_name}</span>`;

export default  (o) => {
    const i18n_remove = __('Click to remove %1$s as a contact', o.display_name);
    return html`
        ${ api.settings.get('allow_chat_pending_contacts') ? html`<a class="list-item-link open-chat w-100" href="#" @click=${o.openChat}>${tpl_pending_contact(o)}</a>` : tpl_pending_contact(o) }
        <a class="list-item-action remove-xmpp-contact far fa-trash-alt" @click=${o.removeContact} title="${i18n_remove}" href="#"></a>`;
}
