import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { __ } from 'i18n';

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
        <h3 class="social-onboarding__title">${__('Follow people to fill your feed')}</h3>
        <p class="social-onboarding__subtitle">${__('These contacts share a social feed you can follow.')}</p>
        <ul class="social-onboarding__list">
            ${repeat(
                el.candidates,
                (c) => c.jid,
                (c) => html`
                    <li class="social-onboarding__item">
                        <label class="social-onboarding__label">
                            <input
                                type="checkbox"
                                .checked=${el.selected.has(c.jid)}
                                @change=${() => el.toggleSelect(c.jid)}
                            />
                            <span class="social-onboarding__name">${c.name}</span>
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
