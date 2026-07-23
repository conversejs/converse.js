import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { until } from 'lit/directives/until.js';
import { __ } from 'i18n';
import { _converse, u } from '@converse/headless';

/**
 * Whether an Atom `<link rel="enclosure">` is an image, by its MIME type or,
 * failing that, its URL extension.
 * @param {{ href: string, type?: string }} enc
 * @returns {boolean}
 */
const isImageEnclosure = (enc) =>
    (enc.type || '').toLowerCase().startsWith('image/') || (!enc.type && u.isURLWithImageExtension(enc.href));

/**
 * The image tiles for an XEP-0472 gallery: one per image enclosure across the
 * rendered post window. Clicking a tile opens the shared lightbox.
 * @param {import('../profile.js').default} el
 * @param {import('@converse/skeletor').Model[]} posts
 */
function galleryTiles(el, posts) {
    const tiles = [];
    for (const p of posts) {
        if (p instanceof _converse.exports.PubsubPlaceholderMessage) continue;
        for (const enc of (p.get('enclosures') ?? []).filter(isImageEnclosure)) {
            tiles.push(
                html`<a
                    class="social-gallery__tile"
                    href="${enc.href}"
                    title="${enc.title ?? ''}"
                    @click=${(/** @type {MouseEvent} */ ev) => el.onTileClick(ev, enc)}
                >
                    <img src="${enc.href}" alt="${enc.title ?? ''}" loading="lazy" />
                </a>`,
            );
        }
    }
    return tiles;
}

/**
 * @param {import('../profile.js').default} el
 */
export default (el) => {
    const profile = el.profile;
    const name = el.isFeed ? el.node : profile.getDisplayName();
    const posts = el.windowedItems; // Only render a window of the feed.
    const is_gallery = el.feed?.isGallery?.() ?? false; // Gallery posts render as a grid

    // Show the author's banner when they've published one and it loads. Otherwise
    // fall back to a Converse logo watermark.
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
                    ? html`<img src="${banner_url}" alt="" loading="lazy" @error=${() => el.onBannerError()} />`
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
                          ${el.isFeed
                              ? '' // a community feed isn't a person: no message / add-contact
                              : html`<converse-dropdown
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
                                                      <converse-icon
                                                          class="fa fa-user-plus"
                                                          size="1.5em"
                                                      ></converse-icon>
                                                      ${__('Add to contacts')}
                                                  </a>`,
                                              ]),
                                    ]}
                                ></converse-dropdown>`}
                      </span>`}
            </div>

            ${el.isFeed
                ? '' // a community feed has no "following" list of its own
                : html`<nav class="social-profile__tabs" role="tablist">
                      <button
                          type="button"
                          role="tab"
                          class="social-profile__tab ${el.tab === 'following' ? '' : 'social-profile__tab--active'}"
                          aria-selected=${el.tab !== 'following'}
                          @click=${() => el.onTab('posts')}
                      >
                          ${__('Posts')}
                      </button>
                      <button
                          type="button"
                          role="tab"
                          class="social-profile__tab ${el.tab === 'following' ? 'social-profile__tab--active' : ''}"
                          aria-selected=${el.tab === 'following'}
                          @click=${() => el.onTab('following')}
                      >
                          ${__('Following')}${el.followingCount > 0
                              ? html`<span class="social-profile__tab-count">${el.followingCount}</span>`
                              : ''}
                      </button>
                  </nav>`}
            ${el.tab === 'following' && !el.isFeed
                ? html`<converse-social-following jid=${el.jid}></converse-social-following>`
                : html`<div class="social-profile__posts ${is_gallery ? 'social-profile__posts--gallery' : ''}">
                      ${posts.length
                          ? is_gallery
                              ? html`<div class="social-gallery">${galleryTiles(el, posts)}</div>`
                              : repeat(
                                    posts,
                                    /** @param {import('@converse/headless').PubSubMessage} p */ (p) => p.get('id'),
                                    (p) =>
                                        p instanceof _converse.exports.PubsubPlaceholderMessage
                                            ? html`<converse-history-placeholder
                                                  .model=${p}
                                              ></converse-history-placeholder>`
                                            : html`<converse-social-message
                                                  .model=${p}
                                                  ?hidesource=${el.isFeed}
                                              ></converse-social-message>`,
                                )
                          : !el._loaded
                            ? html`<p class="social-feed__empty">${__('Loading…')}</p>`
                            : el.accessDenied
                              ? html`<p class="social-feed__empty social-profile__restricted">
                                    <converse-icon size="1.2em" class="fa fa-lock"></converse-icon>
                                    ${__("%1$s's posts aren't public, and are only shared with contacts.", name)}
                                </p>`
                              : html`<p class="social-feed__empty">${__('No posts yet.')}</p>`}
                  </div>`}
        </div>
    `;
};
