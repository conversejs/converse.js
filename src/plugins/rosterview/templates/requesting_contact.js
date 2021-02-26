import { api } from "@converse/headless/core";
import { html } from "lit-html";

const tpl_requesting_contact = o => html`<span class="req-contact-name w-100" title="JID: ${o.jid}">${o.display_name}</span>`;

export default  (o) => html`
   ${ api.settings.get('allow_chat_pending_contacts') ? html`<a class="open-chat w-100" href="#" @click=${o.openChat}>${tpl_requesting_contact(o) }</a>` : tpl_requesting_contact(o) }
   <a class="accept-xmpp-request list-item-action list-item-action--visible fa fa-check"
      @click=${o.acceptRequest}
      aria-label="${o.desc_accept}" title="${o.desc_accept}" href="#"></a>
   <a class="decline-xmpp-request list-item-action list-item-action--visible  fa fa-times"
      @click=${o.declineRequest}
      aria-label="${o.desc_decline}" title="${o.desc_decline}" href="#"></a>`;
