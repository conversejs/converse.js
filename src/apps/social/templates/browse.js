import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { api } from '@converse/headless';
import { __ } from 'i18n';

/**
 * One node row: a title, meta badges (feed type, subscriber count) and a
 * per-row follow button reflecting {@link _converse.api.microblog.isFollowing}
 * and the transient follow state the component tracks.
 * @param {import('../browse.js').default} el
 * @param {import('../types').BrowsableFeed} feed
 */
const tplRow = (el, feed) => {
    const key = `${feed.jid}/${feed.node}`;
    const state = el.follow_state.get(key);
    const following = state === 'done' || api.microblog.isFollowing(feed.jid, feed.node);
    const label = feed.title || feed.name || feed.node;

    let button;
    if (following) {
        button = html`<span class="social-browse__following">${__('Following')}</span>`;
    } else if (state === 'pending') {
        button = html`<button type="button" class="btn btn-sm btn-primary" disabled>${__('Following…')}</button>`;
    } else {
        button = html`<button type="button" class="btn btn-sm btn-primary" @click=${() => el.follow(feed)}>
            ${state === 'error' ? __('Retry') : __('Follow')}
        </button>`;
    }

    // A real link (with an href) when URL routing is on, so the row can be
    // middle-/⌘-clicked into a new tab; a button otherwise (no URL to open).
    const href = el.hrefFor(feed);

    return html`<li class="social-browse__item">
        <a
            class="social-browse__info"
            href=${ifDefined(href)}
            role=${ifDefined(href ? undefined : 'button')}
            tabindex="0"
            title=${__('Preview this feed')}
            @click=${(/** @type {MouseEvent} */ ev) => el.openFeed(feed, ev)}
            @keydown=${(/** @type {KeyboardEvent} */ ev) => el.onRowKeydown(ev, feed)}
        >
            <span class="social-browse__title">${label}</span>
            <span class="social-browse__meta">
                ${feed.is_feed ? html`<span class="social-browse__badge">${__('Feed')}</span>` : ''}
                ${feed.num_subscribers !== undefined
                    ? html`<span class="social-browse__subs"
                          >${feed.num_subscribers === 1
                              ? __('1 subscriber')
                              : __('%1$s subscribers', feed.num_subscribers)}</span
                      >`
                    : ''}
                <span class="social-browse__node">${feed.node}</span>
            </span>
            ${feed.description ? html`<span class="social-browse__desc">${feed.description}</span>` : ''}
            ${state === 'error'
                ? html`<span class="social-browse__error text-danger">${__('Could not follow this feed')}</span>`
                : ''}
        </a>
        ${button}
    </li>`;
};

/**
 * @param {import('../browse.js').default} el
 */
export default (el) => {
    const feeds = el.results.filter((f) => f.is_feed);
    const others = el.results.filter((f) => !f.is_feed);
    const visible = el.show_all ? [...feeds, ...others] : feeds;
    const done = !el.busy && (el.results.length > 0 || el.error === null);

    return html`<div class="social-browse">
        <form class="social-browse__form" @submit=${(/** @type {Event} */ ev) => el.browse(ev)}>
            <input
                type="text"
                name="service"
                class="form-control"
                autocomplete="off"
                placeholder="pubsub.example.org"
                .value=${el.service}
                @input=${(/** @type {Event} */ ev) => el.onServiceInput(ev)}
            />
            ${el.browsing
                ? html`<button type="button" class="btn btn-secondary" @click=${() => el.cancel()}>
                      ${__('Cancel')}
                  </button>`
                : html`<button type="submit" class="btn btn-secondary" ?disabled=${!el.service.trim()}>
                      ${__('Browse')}
                  </button>`}
        </form>

        ${el.browsing ? html`<p class="social-browse__progress form-text text-muted">${__('Reading feeds…')}</p>` : ''}
        ${el.error ? html`<p class="social-browse__error text-danger">${el.error}</p>` : ''}
        ${done && el.results.length === 0 && !el.has_more
            ? html`<p class="social-browse__empty form-text text-muted">${__('This service has no feeds to show.')}</p>`
            : ''}
        ${done && el.results.length > 0 && feeds.length === 0 && !el.show_all
            ? html`<p class="social-browse__empty form-text text-muted">
                  ${__('No social feeds found on this service.')}
              </p>`
            : ''}
        ${visible.length
            ? html`<ul class="social-browse__list">
                  ${repeat(
                      visible,
                      (f) => `${f.jid}/${f.node}`,
                      (f) => tplRow(el, f),
                  )}
              </ul>`
            : ''}
        ${!el.browsing && others.length
            ? html`<button type="button" class="social-browse__toggle" @click=${() => el.toggleShowAll()}>
                  ${el.show_all
                      ? __('Hide non-feed nodes')
                      : others.length === 1
                        ? __('Show 1 other node')
                        : __('Show %1$s other nodes', others.length)}
              </button>`
            : ''}
        ${el.has_more && !el.browsing
            ? html`<button
                  type="button"
                  class="social-browse__more btn btn-secondary btn-sm"
                  ?disabled=${el.loading_more}
                  @click=${() => el.loadMore()}
              >
                  ${el.loading_more ? __('Loading…') : __('Load more')}
              </button>`
            : ''}
    </div>`;
};
