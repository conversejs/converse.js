import { __ } from 'i18n';
import { api } from '@converse/headless';
import { html } from 'lit';
import { getUnreadMsgsDisplay } from 'shared/chat/utils.js';
import { tplRemoveLink } from './roster_item';

/**
 * @param {import('../contactview').default} el
 */
export default (el) => {
    const num_unread = getUnreadMsgsDisplay(el.model);
    const display_name = el.model.getDisplayName();
    const jid = el.model.get('jid');

    const i18n_add_contact = __('Click to add %1$s to your roster', display_name);
    const i18n_chat = __('Click to chat with %1$s (XMPP address: %2$s)', display_name, jid);
    return html`
        <a
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
        <span>
            <a
                class="add-contact list-item-action"
                @click="${(ev) => el.addContact(ev)}"
                aria-label="${i18n_add_contact}"
                title="${i18n_add_contact}"
                href="#"
            >
                <converse-icon class="fa fa-user-plus" size="1.5em"></converse-icon>
            </a>
            ${api.settings.get('allow_contact_removal') ? tplRemoveLink(el) : ''}
        </span>
    `;
};
