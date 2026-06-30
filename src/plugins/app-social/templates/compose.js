import { html } from 'lit';
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
            <converse-social-scan></converse-social-scan>
            <button type="submit" class="btn btn-primary">${__('Post')}</button>
        </div>
    </form>
`;
