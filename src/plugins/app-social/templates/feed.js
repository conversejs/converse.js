import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { __ } from 'i18n';

/**
 * @param {import('../feed.js').default} el
 */
export default (el) => {
    // Reading the signal here is auto-tracked by `SignalWatcher`, so the list
    // re-renders when the underlying collection changes.
    const posts = el.posts.get();
    return html`
        <div class="social-feed">
            <converse-social-onboarding></converse-social-onboarding>
            <converse-social-compose .model=${el.model}></converse-social-compose>
            <div class="social-feed__posts">
                ${posts.length
                    ? repeat(
                          posts,
                          /** @param {import('@converse/headless').PubSubMessage} p */ (p) => p.get('id'),
                          (p) => html`<converse-social-message .model=${p}></converse-social-message>`,
                      )
                    : html`<p class="social-feed__empty">${__('No posts yet.')}</p>`}
            </div>
        </div>
    `;
};
