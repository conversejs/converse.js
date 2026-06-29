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
            ${m.contact
                ? html`<a class="show-msg-author-modal social-post__avatar" @click=${(ev) => el.showUserModal(ev)}
                      >${avatar}</a
                  >`
                : html`<span class="social-post__avatar">${avatar}</span>`}
            <div class="social-post__main">
                <header class="social-post__header">
                    <span class="social-post__author">${name}</span>
                    <span class="social-post__jid">${m.get('author_jid')}</span>

                    ${m.get('is_repost')
                        ? html`<span class="social-post__badge"
                              ><converse-icon size="0.8em" class="fa fa-retweet"></converse-icon> ${__(
                                  'reposted',
                              )}</span
                          >`
                        : ''}
                    ${time
                        ? html`<time class="social-post__time" datetime="${time}" title="${dayjs(time).format('llll')}"
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
        </article>
    `;
};
