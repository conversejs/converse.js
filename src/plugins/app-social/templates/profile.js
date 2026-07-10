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
    // Show the author's banner when they've published one and it loads; otherwise
    // fall back to a Converse logo watermark so the header never looks broken.
    const banner_url = profile.get('banner_url');
    const has_banner = banner_url && !el._banner_error;

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

            <div class="social-profile__banner ${has_banner ? '' : 'social-profile__banner--fallback'}">
                ${has_banner
                    ? html`<img
                          src="${banner_url}"
                          alt=""
                          loading="lazy"
                          @error=${() => el.onBannerError()}
                      />`
                    : html`<converse-logo></converse-logo>`}
            </div>

            <div class="social-profile__header social-profile__header--with-banner">
                <span class="social-profile__avatar">${avatar}</span>
                <div class="social-profile__identity">
                    <span class="social-profile__name" style="${author_style}">${name}</span>
                    <span class="social-profile__jid">${el.jid}</span>
                </div>
                ${el.isOwn
                    ? html`<button
                          type="button"
                          class="btn btn-secondary social-profile__edit"
                          @click=${(ev) => el.onEditProfile(ev)}
                      >
                          ${__('Edit profile')}
                      </button>`
                    : html`<span class="social-profile__actions">
                          <button
                              type="button"
                              class="btn ${el.isFollowing ? 'btn-secondary' : 'btn-primary'} social-profile__follow"
                              ?disabled=${el._busy}
                              @click=${() => el.onToggleFollow()}
                          >
                              ${el.isFollowing ? __('Unfollow') : __('Follow')}
                          </button>
                          <converse-dropdown
                              class="social-profile__menu btn-group dropstart"
                              icon_classes="fa fa-ellipsis-vertical"
                              .items=${[
                                  html`<a
                                      class="dropdown-item social-profile__message"
                                      role="button"
                                      @click=${(ev) => el.onMessage(ev)}
                                  >
                                      <converse-icon class="fa fa-comments" size="1.5em"></converse-icon>
                                      ${__('Message')}
                                  </a>`,
                                  ...(el.isContact
                                      ? []
                                      : [
                                            html`<a
                                                class="dropdown-item social-profile__add-contact"
                                                role="button"
                                                @click=${(ev) => el.onAddContact(ev)}
                                            >
                                                <converse-icon class="fa fa-user-plus" size="1.5em"></converse-icon>
                                                ${__('Add to contacts')}
                                            </a>`,
                                        ]),
                              ]}
                          ></converse-dropdown>
                      </span>`}
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
