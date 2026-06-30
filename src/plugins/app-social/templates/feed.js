import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { __ } from 'i18n';

/**
 * @param {import('../feed.js').default} el
 */
function tplFilterBar(el) {
    return html`<div class="social-feed__filter">
        <span class="social-feed__filter-label">
            ${__('Posts tagged')} <strong class="social-post__hashtag">#${el.filter}</strong>
        </span>
        <button
            type="button"
            class="social-feed__filter-clear"
            @click=${() => el.clearFilter()}
            title="${__('Clear filter')}"
            aria-label="${__('Clear filter')}"
        >
            <converse-icon size="0.8em" class="fa fa-times"></converse-icon> ${__('Clear')}
        </button>
    </div>`;
}

/**
 * @param {import('../feed.js').default} el
 */
export default (el) => {
    // Reading the signal (via `visiblePosts`) is auto-tracked by `SignalWatcher`,
    // so the list re-renders when the underlying collection changes.
    const posts = el.visiblePosts;
    const filtering = !!el.filter;

    const empty = filtering
        ? html`<p class="social-feed__empty">${__('No posts tagged #%1$s.', el.filter)}</p>`
        : html`<p class="social-feed__empty">${__('No posts yet.')}</p>`;

    return html`
        <div class="social-feed">
            ${filtering
                ? tplFilterBar(el)
                : html`
                      <converse-social-onboarding></converse-social-onboarding>
                      <converse-social-compose .model=${el.model}></converse-social-compose>
                  `}
            <div class="social-feed__posts">
                ${posts.length
                    ? repeat(
                          posts,
                          /** @param {import('@converse/headless').PubSubMessage} p */ (p) => p.get('id'),
                          (p) => html`<converse-social-message .model=${p}></converse-social-message>`,
                      )
                    : empty}
            </div>
        </div>
    `;
};
