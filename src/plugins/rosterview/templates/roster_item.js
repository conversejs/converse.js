import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from "lit";
import { STATUSES } from '../constants.js';


export default  (el, item) => {
   const show = item.presence.get('show') || 'offline';
   let status_icon;
   if (show === 'online') {
      status_icon = 'fa fa-circle chat-status chat-status--online';
   } else if (show === 'away') {
      status_icon = 'fa fa-circle chat-status chat-status--away';
   } else if (show === 'xa') {
      status_icon = 'far fa-circle chat-status chat-status-xa';
   } else if (show === 'dnd') {
      status_icon = 'fa fa-minus-circle chat-status chat-status--busy';
   } else {
      status_icon = 'fa fa-times-circle chat-status chat-status--offline';
   }
   const display_name = item.getDisplayName();
   const desc_status = STATUSES[show];
   const num_unread = item.get('num_unread') || 0;
   const i18n_chat = __('Click to chat with %1$s (XMPP address: %2$s)', display_name, el.jid);
   const i18n_remove = __('Click to remove %1$s as a contact', display_name);
   return html`
   <a class="list-item-link cbox-list-item open-chat ${ num_unread ? 'unread-msgs' : '' }" title="${i18n_chat}" href="#" @click=${el.openChat}>
      <converse-avatar
         class="avatar"
         .data=${el.model.vcard?.attributes}
         nonce=${el.model.vcard?.get('vcard_updated')}
         height="30" width="30"></converse-avatar>
      <span class="${status_icon}" title="${desc_status}"></span>
      ${ num_unread ? html`<span class="msgs-indicator">${ num_unread }</span>` : '' }
      <span class="contact-name contact-name--${el.show} ${ num_unread ? 'unread-msgs' : ''}">${display_name}</span>
   </a>
   ${ api.settings.get('allow_contact_removal') ? html`<a class="list-item-action remove-xmpp-contact far fa-trash-alt" @click=${el.removeContact} title="${i18n_remove}" href="#"></a>` : '' }`;
}
