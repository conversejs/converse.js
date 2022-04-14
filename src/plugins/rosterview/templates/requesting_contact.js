import { html } from "lit";

export default (o) => html`
   <a class="open-chat w-100" href="#" @click=${o.openChat}>
      <span class="req-contact-name w-100" title="JID: ${o.jid}">${o.display_name}</span>
   </a>
   <a class="accept-xmpp-request list-item-action list-item-action--visible fa fa-check"
      @click=${o.acceptRequest}
      aria-label="${o.desc_accept}" title="${o.desc_accept}" href="#"></a>
   <a class="decline-xmpp-request list-item-action list-item-action--visible  fa fa-times"
      @click=${o.declineRequest}
      aria-label="${o.desc_decline}" title="${o.desc_decline}" href="#"></a>`;
