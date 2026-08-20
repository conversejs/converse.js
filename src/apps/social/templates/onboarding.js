import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { until } from 'lit/directives/until.js';

/**
 * Render a followable contact's clickable avatar and display name. The contact
 * is resolved asynchronously from its bare JID; candidates are roster contacts,
 * so this normally resolves right away.
 * @param {import('../onboarding.js').default} el
 * @param {string} jid
 */
const tplContact = async (el, jid) => {
    const contact = await api.contacts.get(jid);
    if (!contact) return '';

    const name = contact.getDisplayName();
    return html`
        <a class="show-msg-author-modal" @click=${(ev) => el.showUserModal(ev, contact)}>
            <converse-avatar
                .model=${contact}
                class="avatar align-self-center"
                name="${name}"
                nonce=${contact.vcard?.get('vcard_updated')}
                height="40"
                width="40"
            ></converse-avatar>
            <span class="social-onboarding__name">${name}</span>
        </a>
    `;
};

/**
 * @param {import('../onboarding.js').default} el
 */
export default (el) => html`
    <div class="social-onboarding">
        <button
            type="button"
            class="social-onboarding__dismiss"
            title="${__('Dismiss')}"
            aria-label="${__('Dismiss')}"
            @click=${() => el.dismiss()}
        >
            <converse-icon class="fa fa-times" size="1em"></converse-icon>
        </button>
        <h3 class="social-onboarding__title">${__('Accounts you might like to follow')}</h3>
        <ul class="social-onboarding__list">
            ${repeat(
                el.candidates,
                (jid) => jid,
                (jid) => html`
                    <li class="social-onboarding__item">
                        <label class="social-onboarding__label">
                            <input
                                type="checkbox"
                                .checked=${el.selected.has(jid)}
                                @change=${() => el.toggleSelect(jid)}
                            />
                            ${until(tplContact(el, jid), '')}
                        </label>
                    </li>
                `,
            )}
        </ul>
        <div class="social-onboarding__actions">
            <button
                type="button"
                class="btn btn-primary"
                ?disabled=${el.busy || el.selected.size === 0}
                @click=${() => el.followSelected()}
            >
                ${el.busy ? __('Following…') : __('Follow selected')}
            </button>
        </div>
    </div>
`;
