import { html } from 'lit/html.js';
import { __ } from 'i18n';
import tplSpinner from 'templates/spinner.js';

/**
 * @param {import('../placeholder').default} el
 */
export default (el) => {
    if (el.model.get('fetching')) {
        return tplSpinner({ class: 'hor_centered' });
    }
    // A placeholder that stands in for the not-yet-loaded posts. It has a real
    // height so it's both visible and able to trip the IntersectionObserver (which
    // auto-loads the missing posts when it scrolls into view); the click is a manual
    // fallback.
    return html`<a
        class="social-feed__placeholder"
        role="button"
        title="${__('Load older posts')}"
        aria-label="${__('Load older posts')}"
        @click="${(ev) => el.fetchMissingMessages(ev)}"
    >
        <span class="social-feed__placeholder-line"></span>
        <span class="social-feed__placeholder-line"></span>
    </a>`;
};
