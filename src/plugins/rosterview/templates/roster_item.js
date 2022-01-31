import { __ } from 'i18n';
import { api } from "@converse/headless/core.js";
import { html } from "lit";
import { STATUSES } from '../constants.js';

const tpl_remove_link = (el, item) => {
   const display_name = item.getDisplayName();
   const i18n_remove = __('Click to remove %1$s as a contact', display_name);
   return html`
      <a class="list-item-action remove-xmpp-contact" @click=${el.removeContact} title="${i18n_remove}" href="#">
         <converse-icon class="fa fa-trash-alt" size="1.5em"></converse-icon>
      </a>
   `;
}

export default  (el, item) => {
   const show = item.presence.get('show') || 'offline';
    let classes, color;
    if (show === 'online') {
        [classes, color] = ['fa fa-circle', 'chat-status-online'];
    } else if (show === 'dnd') {
        [classes, color] =  ['fa fa-minus-circle', 'chat-status-busy'];
    } else if (show === 'away') {
        [classes, color] =  ['fa fa-circle', 'chat-status-away'];
    } else {
        [classes, color] = ['fa fa-circle', 'subdued-color'];
    }
   const desc_status = STATUSES[show];
   const num_unread = item.get('num_unread') || 0;
   const display_name = item.getDisplayName();
   const i18n_chat = __('Click to chat with %1$s (XMPP address: %2$s)', display_name, el.model.get('jid'));
   return html`
   <a class="list-item-link cbox-list-item open-chat ${ num_unread ? 'unread-msgs' : '' }" title="${i18n_chat}" href="#" @click=${el.openChat}>
      <span>
         <converse-avatar
            class="avatar"
            .data=${el.model.vcard?.attributes}
            nonce=${el.model.vcard?.get('vcard_updated')}
            height="30" width="30"></converse-avatar>
         <converse-icon
            title="${desc_status}"
            color="var(--${color})"
            size="1em"
            class="${classes} chat-status chat-status--avatar"></converse-icon>
      </span>
      ${ num_unread ? html`<span class="msgs-indicator">${ num_unread }</span>` : '' }
      <span class="contact-name contact-name--${el.show} ${ num_unread ? 'unread-msgs' : ''}">${display_name}</span>
   </a>
   ${ api.settings.get('allow_contact_removal') ? tpl_remove_link(el, item) : '' }`;
}
