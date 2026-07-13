import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';

/**
 * @param {import('../compose.js').default} el
 */
export default (el) => html`
    <form class="social-compose" @submit=${(ev) => el.onSubmit(ev)}>
        <textarea
            class="social-compose__textarea"
            rows="3"
            placeholder="${__('What’s on your mind?')}"
            @keydown=${(ev) => el.onKeyDown(ev)}
        ></textarea>
        <div class="social-compose__toolbar">
            <button
                type="button"
                class="social-discover__btn"
                @click=${(ev) => api.modal.show('converse-social-discover-modal', {}, ev)}
            >
                <converse-icon class="fa fa-search" size="0.9em"></converse-icon> ${__('Discover')}
            </button>
            <button type="submit" class="btn btn-primary">${__('Post')}</button>
        </div>
    </form>
`;
