import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { __ } from 'i18n';
import { _converse } from '@converse/headless';

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
            @click=${() => el.dispatchEvent(new CustomEvent('clearfilter', { bubbles: true, composed: true }))}
            title="${__('Clear filter')}"
            aria-label="${__('Clear filter')}"
        >
            <converse-icon size="0.8em" class="fa fa-times"></converse-icon> ${__('Clear')}
        </button>
    </div>`;
}

/**
 * A slim entry point to your own "Following" list (your profile's Following tab),
 * shown only once you follow at least one author. The timeline re-renders on every
 * follow/unfollow (via the aggregated `pubsubfeeds` signal), so the count stays live.
 * @param {import('../feed.js').default} el
 */
function tplFollowingBar(el) {
    const count = _converse.state.following?.length ?? 0;
    if (!count) return '';

    const jid = _converse.session.get('bare_jid');
    return html`<div class="social-feed__following">
        <button
            type="button"
            class="social-feed__following-btn"
            @click=${() =>
                el.dispatchEvent(
                    new CustomEvent('profileselected', {
                        detail: { jid, tab: 'following' },
                        bubbles: true,
                        composed: true,
                    }),
                )}
        >
            <converse-icon size="0.9em" class="fa fa-users"></converse-icon>
            ${__('Following')} <span class="social-feed__following-count">${count}</span>
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

    const own_jid = _converse.session.get('bare_jid');
    const own_profile = _converse.state.profile;
    const i18n_view_feed = __('View own feed');

    const empty = filtering
        ? html`<p class="social-feed__empty">${__('No posts tagged #%1$s.', el.filter)}</p>`
        : html`<p class="social-feed__empty">${__('No posts yet.')}</p>`;

    return html`
        <div class="social-feed">
            ${filtering
                ? tplFilterBar(el)
                : html`
                      <div class="social-feed__header">
                          <div class="social-feed__profile">
                              <a
                                  href="#"
                                  @click="${(ev) => {
                                      ev.preventDefault();
                                      el.dispatchEvent(
                                          new CustomEvent('profileselected', {
                                              detail: { jid: own_jid, tab: 'posts' },
                                              bubbles: true,
                                              composed: true,
                                          }),
                                      );
                                  }}"
                                  title="${i18n_view_feed}"
                              >
                                  <converse-avatar
                                      class="avatar align-self-center"
                                      .model=${own_profile}
                                      name="${own_profile.getDisplayName()}"
                                      nonce=${own_profile.vcard?.get('vcard_updated')}
                                      height="40"
                                      width="40"
                                  ></converse-avatar>
                              </a>
                          </div>
                          ${tplFollowingBar(el)}
                      </div>
                      <converse-social-compose .model=${el.model}></converse-social-compose>
                      <converse-social-onboarding></converse-social-onboarding>
                  `}
            <div class="social-feed__posts">
                ${posts.length
                    ? repeat(
                          posts,
                          /** @param {import('@converse/headless').PubSubMessage} p */ (p) => p.get('id'),
                          (p) => {
                              if (p instanceof _converse.exports.PubsubPlaceholderMessage) {
                                  return html`<converse-history-placeholder
                                      .model=${p}
                                  ></converse-history-placeholder>`;
                              } else {
                                  return html`<converse-social-message .model=${p}></converse-social-message>`;
                              }
                          },
                      )
                    : empty}
            </div>
        </div>
    `;
};
