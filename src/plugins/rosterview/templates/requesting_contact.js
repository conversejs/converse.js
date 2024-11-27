import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import('../contactview').default} el
 */
export default (el) => {
    const display_name = el.model.getDisplayName();
    const desc_accept = __('Click to accept the contact request from %1$s', display_name);
    const desc_decline = __('Click to decline the contact request from %1$s', display_name);
    return html` <a class="open-chat w-100" href="#" @click="${(ev) => el.openChat(ev)}">
            <span class="req-contact-name w-100" title="JID: ${el.model.get('jid')}">${display_name}</span>
        </a>
        <a
            class="accept-xmpp-request list-item-action list-item-action--visible"
            @click=${(ev) => el.acceptRequest(ev)}
            aria-label="${desc_accept}"
            title="${desc_accept}"
            href="#"
        >
            <converse-icon class="fa fa-check" size="1em"></converse-icon>
        </a>

        <a
            class="decline-xmpp-request list-item-action list-item-action--visible"
            @click=${(ev) => el.declineRequest(ev)}
            aria-label="${desc_decline}"
            title="${desc_decline}"
            href="#"
        >
            <converse-icon class="fa fa-times" size="1em"></converse-icon>
        </a>`;
};
