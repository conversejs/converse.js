import { html } from 'lit';
import { __ } from 'i18n';
import { converse } from '@converse/headless';

const { dayjs } = converse.env;

/**
 * @param {import('../message.js').default} el
 */
export default (el) => {
    const m = el.model;
    const time = m.get('time');
    return html`
        <article class="social-post ${m.get('is_mine') ? 'social-post--mine' : ''}">
            <header class="social-post__header">
                <span class="social-post__author">${m.get('displayName')}</span>
                ${m.get('is_repost')
                    ? html`<span class="social-post__badge"><converse-icon size="0.8em" class="fa fa-retweet"></converse-icon> ${__('reposted')}</span>`
                    : ''}
                ${time
                    ? html`<time class="social-post__time" datetime="${time}">${dayjs(time).format('lll')}</time>`
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
        </article>
    `;
};
