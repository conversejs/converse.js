import { html } from 'lit';
import { __ } from 'i18n';
import { converse } from '@converse/headless';
import { getRelativeTime } from 'utils/time.js';

const { dayjs } = converse.env;

/**
 * @param {import('../message.js').default} el
 */
export default (el) => {
    const m = el.model;
    const time = m.get('time');
    const name = m.get('displayName');

    // For a repost the main author (avatar + name + handle) is the *original*
    // poster; this eyebrow names who repeated it into the feed, so the two are
    // never conflated (X.com-style "<reposter> reposted").
    const reposter = m.get('is_mine') ? __('You') : (m.getReposterName() ?? '');

    const avatar = html`<converse-avatar
        .model=${m}
        class="avatar"
        name="${name}"
        nonce=${m.vcard?.get('vcard_updated')}
        height="40"
        width="40"
    ></converse-avatar>`;

    return html`
        <article class="social-post ${m.get('is_mine') ? 'social-post--mine' : ''}">
            ${m.get('is_repost')
                ? html`<div class="social-post__repost">
                      <converse-icon size="0.8em" class="fa fa-retweet"></converse-icon>
                      <span>${__('%1$s reposted', reposter)}</span>
                  </div>`
                : ''}
            <div class="social-post__row">
                ${m.contact
                    ? html`<a class="show-msg-author-modal social-post__avatar" @click=${(ev) => el.showUserModal(ev)}
                          >${avatar}</a
                      >`
                    : html`<span class="social-post__avatar">${avatar}</span>`}
                <div class="social-post__main">
                    <header class="social-post__header">
                        <span class="social-post__author">${name}</span>
                        <span class="social-post__jid">${m.get('author_jid')}</span>

                        ${time
                            ? html`<time
                                  class="social-post__time"
                                  datetime="${time}"
                                  title="${dayjs(time).format('llll')}"
                                  >${getRelativeTime(time)}</time
                              >`
                            : ''}
                        ${m.get('is_mine')
                            ? html`<button
                                  type="button"
                                  class="social-post__action"
                                  title="${__('Delete')}"
                                  aria-label="${__('Delete')}"
                                  @click=${() => el.onRetract()}
                              >
                                  <converse-icon size="1em" class="fa fa-trash-alt"></converse-icon>
                              </button>`
                            : ''}
                    </header>
                    <div class="social-post__body">${m.get('body') ?? ''}</div>
                </div>
            </div>
        </article>
    `;
};
