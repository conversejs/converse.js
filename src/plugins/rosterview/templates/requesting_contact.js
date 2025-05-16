import { html } from 'lit';
import { __ } from 'i18n';
import { getUnreadMsgsDisplay } from 'shared/chat/utils.js';
import {tplDetailsButton } from './roster_item.js';

/**
 * @param {import('../contactview').default} el
 */
export default (el) => {
    const num_unread = getUnreadMsgsDisplay(el.model);
    const jid = el.model.get('jid');
    const display_name = el.model.getDisplayName();
    const i18n_accept = __('Click to accept the contact request from %1$s (XMPP address: %2$s)', display_name, jid);
    const i18n_decline = __('Click to decline the contact request from %1$s (XMPP address: %2$s)', display_name, jid);
    const i18n_chat = __('Click to chat with %1$s (XMPP address: %2$s)', display_name, jid);
    const btns = [
        html`<a
                class="dropdown-item accept-xmpp-request"
                role="button"
                @click="${(ev) => el.acceptRequest(ev)}"
                aria-label="${i18n_accept}"
                title="${i18n_accept}"
                href="#"
            >
            <converse-icon class="fa fa-check" size="1em"></converse-icon>
            ${__('Accept as contact')}
        </a>`,
        tplDetailsButton(el),
        html`<a class="dropdown-item decline-xmpp-request"
                role="button"
                @click="${(ev) => el.declineRequest(ev)}"
                aria-label="${i18n_decline}"
                title="${i18n_decline}"
            >
            <converse-icon class="fa fa-times" size="1em"></converse-icon>
            ${__('Remove')}
        </a>`,
    ];

    return html`<a
            class="list-item-link cbox-list-item open-chat ${num_unread ? 'unread-msgs' : ''}"
            title="${i18n_chat}"
            href="#"
            data-jid=${jid}
            @click=${el.openChat}
        >
            <span>
                <converse-avatar
                    .model=${el.model}
                    class="avatar"
                    name="${el.model.getDisplayName()}"
                    nonce=${el.model.vcard?.get('vcard_updated')}
                    height="30"
                    width="30"
                ></converse-avatar>
            </span>
            ${num_unread ? html`<span class="msgs-indicator badge">${num_unread}</span>` : ''}
            <span class="contact-name ${num_unread ? 'unread-msgs' : ''}">${display_name}</span>
        </a>
        <span class="contact-actions">
            <converse-dropdown class="btn-group dropstart list-item-action" .items=${btns}></converse-dropdown>
        </span>`;
};
