import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from "lit-html";
import { renderAvatar } from 'templates/directives/avatar';

export default  (o) => {
   const i18n_chat = __('Click to chat with %1$s (XMPP address: %2$s)', o.display_name, o.jid);
   const i18n_remove = __('Click to remove %1$s as a contact', o.display_name);
   return html`
   <a class="list-item-link cbox-list-item open-chat w-100 ${ o.num_unread ? 'unread-msgs' : '' }" title="${i18n_chat}" href="#" @click=${o.openChat}>
      ${ renderAvatar(o.getAvatarData()) }
      <span class="${o.status_icon}" title="${o.desc_status}"></span>
      ${ o.num_unread ? html`<span class="msgs-indicator">${ o.num_unread }</span>` : '' }
      <span class="contact-name contact-name--${o.show} ${ o.num_unread ? 'unread-msgs' : ''}">${o.display_name}</span>
   </a>
   ${ api.settings.get('allow_contact_removal') ? html`<a class="list-item-action remove-xmpp-contact far fa-trash-alt" @click=${o.removeContact} title="${i18n_remove}" href="#"></a>` : '' }`;
}
