import { __ } from 'i18n';
import { _converse, api } from '@converse/headless';
import { html } from 'lit';
import { getUnreadMsgsDisplay } from 'shared/chat/utils.js';
import { STATUSES } from '../constants.js';

/**
 * @param {import('../contactview').default} el
 */
export function tplRemoveButton(el) {
    const display_name = el.model.getDisplayName();
    const i18n_remove = __('Click to remove %1$s as a contact', display_name);
    return html`<a
        class="dropdown-item remove-xmpp-contact"
        role="button"
        @click="${(ev) => el.removeContact(ev)}"
        title="${i18n_remove}"
        data-toggle="modal"
    >
        <converse-icon class="fa fa-trash-alt" size="1em"></converse-icon>
        ${__('Remove')}
    </a>`;
}

/**
 * @param {import('../contactview').default} el
 */
export function tplDetailsButton(el) {
    const display_name = el.model.getDisplayName();
    const i18n_remove = __('Click to show more details about %1$s', display_name);
    return html`<a
        class="dropdown-item"
        role="button"
        @click="${(ev) => el.showUserDetailsModal(ev)}"
        title="${i18n_remove}"
        data-toggle="modal"
    >
        <converse-icon class="fa fa-id-card" size="1em"></converse-icon>
        ${__('Details')}
    </a>`;
}

/**
 * @param {import('../contactview').default} el
 */
export default (el) => {
    const bare_jid = _converse.session.get('bare_jid');
    const show = el.model.getStatus() || 'offline';
    let classes, color;
    if (show === 'online') {
        [classes, color] = ['fa fa-circle', 'chat-status-online'];
    } else if (show === 'dnd') {
        [classes, color] = ['fa fa-minus-circle', 'chat-status-busy'];
    } else if (show === 'away') {
        [classes, color] = ['fa fa-circle', 'chat-status-away'];
    } else {
        [classes, color] = ['fa fa-circle', 'chat-status-offline'];
    }

    const is_self = bare_jid === el.model.get('jid');
    const desc_status = STATUSES[show];
    const num_unread = getUnreadMsgsDisplay(el.model);
    const display_name = el.model.getDisplayName({ context: 'roster' });
    const jid = el.model.get('jid');
    const i18n_chat = is_self
        ? __('Click to chat with yourself')
        : __('Click to chat with %1$s (XMPP address: %2$s)', display_name, jid);

    const btns = [
        tplDetailsButton(el),
        ...(api.settings.get('allow_contact_removal') && !is_self ? [tplRemoveButton(el)] : []),
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

                ${['both', 'to'].includes(el.model.get('subscription'))
                    ? html` <converse-icon
                          title="${desc_status}"
                          color="var(--${color})"
                          size="1em"
                          class="${classes} chat-status chat-status--avatar"
                      ></converse-icon>`
                    : ''}
            </span>
            ${num_unread ? html`<span class="msgs-indicator badge">${num_unread}</span>` : ''}
            <span class="contact-name contact-name--${show} ${num_unread ? 'unread-msgs' : ''}">${display_name}</span>
        </a>
        <span class="contact-actions">
            <converse-dropdown class="btn-group dropstart list-item-action" .items=${btns}></converse-dropdown>
        </span>`;
};
