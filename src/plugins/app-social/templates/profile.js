import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { until } from 'lit/directives/until.js';
import { __ } from 'i18n';
import { _converse } from '@converse/headless';

/**
 * @param {import('../profile.js').default} el
 */
export default (el) => {
    const profile = el.profile;
    const name = profile.getDisplayName();
    const posts = el.authorPosts;

    // Colour the author's name to match their avatar (per-author colour).
    const author_style = until(
        profile.getColor().then((c) => `color: ${c}`),
        '',
    );

    const avatar = html`<converse-avatar
        .model=${profile}
        class="avatar"
        name="${name}"
        nonce=${profile.vcard?.get('vcard_updated')}
        height="64"
        width="64"
    ></converse-avatar>`;

    return html`
        <div class="social-profile">
            <header class="social-post-detail__bar">
                <button
                    type="button"
                    class="social-post-detail__back"
                    @click=${() => el.goBack()}
                    title="${__('Back')}"
                    aria-label="${__('Back')}"
                >
                    <converse-icon size="1em" class="fa fa-arrow-left"></converse-icon>
                    <span>${__('Back')}</span>
                </button>
            </header>

            <div class="social-profile__header">
                <span class="social-profile__avatar">${avatar}</span>
                <div class="social-profile__identity">
                    <span class="social-profile__name" style="${author_style}">${name}</span>
                    <span class="social-profile__jid">${el.jid}</span>
                </div>
                ${el.isOwn
                    ? ''
                    : html`<button
                          type="button"
                          class="btn ${el.isFollowing ? 'btn-secondary' : 'btn-primary'} social-profile__follow"
                          ?disabled=${el._busy}
                          @click=${() => el.onToggleFollow()}
                      >
                          ${el.isFollowing ? __('Unfollow') : __('Follow')}
                      </button>`}
            </div>

            <div class="social-profile__posts">
                ${posts.length
                    ? repeat(
                          posts,
                          /** @param {import('@converse/headless').PubSubMessage} p */ (p) => p.get('id'),
                          (p) =>
                              p instanceof _converse.exports.PubsubPlaceholderMessage
                                  ? html`<converse-history-placeholder .model=${p}></converse-history-placeholder>`
                                  : html`<converse-social-message .model=${p}></converse-social-message>`,
                      )
                    : !el._loaded
                      ? html`<p class="social-feed__empty">${__('Loading…')}</p>`
                      : el.accessDenied
                        ? html`<p class="social-feed__empty social-profile__restricted">
                              <converse-icon size="1.2em" class="fa fa-lock"></converse-icon>
                              ${__("%1$s's posts aren't public, and are only shared with contacts.", name)}
                          </p>`
                        : html`<p class="social-feed__empty">${__('No posts yet.')}</p>`}
            </div>
        </div>
    `;
};
