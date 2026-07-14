import DOMPurify from 'dompurify';
import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { __ } from 'i18n';
import { api, u } from '@converse/headless';
import renderTexture from 'shared/texture/directives/texture.js';
import { renderImage } from 'shared/texture/directives/image.js';
import tplVideo from 'shared/texture/templates/video.js';
import tplAudio from 'shared/texture/templates/audio.js';
import 'shared/components/time.js';

/**
 * Classify an Atom `<link rel="enclosure">` attachment by its MIME `type`,
 * falling back to the URL's file extension when the feed omits a type.
 * @param {{ href: string, type?: string }} enc
 * @returns {'image'|'video'|'audio'|'other'}
 */
function enclosureKind(enc) {
    const type = (enc.type || '').toLowerCase();
    if (type.startsWith('image/') || (!type && u.isURLWithImageExtension(enc.href))) return 'image';
    if (type.startsWith('video/') || (!type && u.isVideoURL(enc.href))) return 'video';
    if (type.startsWith('audio/') || (!type && u.isAudioURL(enc.href))) return 'audio';
    return 'other';
}

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

    // Render one Atom text construct. Atom-native feeds (blogs, Movim) send
    // `type="html"`/`"xhtml"` markup, kept as the `_xhtml` variant: render it
    // sanitized so links and formatting survive rather than showing as literal
    // tags. Plain-text constructs go through the shared texture pipeline: URLs,
    // media, emojis and XEP-0393 styling, plus social-only hashtags.
    const render_media = api.settings.get('render_media');
    const renderConstruct = (/** @type {string} */ text, /** @type {string} */ xhtml) =>
        xhtml
            ? html`<div class="social-post__richtext">${unsafeHTML(DOMPurify.sanitize(xhtml))}</div>`
            : renderTexture(text, 0, {
                  render_styling: true,
                  render_hashtags: true,
                  show_images: render_media,
                  embed_audio: render_media,
                  embed_videos: render_media,
                  onImgClick: /** @param {MouseEvent} ev */ (ev) => el.onImgClick(ev),
                  onImgLoad: () => el.onImgLoad(),
              });

    // Render a media attachment (<link rel="enclosure">)
    const renderEnclosure = (/** @type {{ href: string, type?: string, title?: string }} */ enc) => {
        if (render_media) {
            switch (enclosureKind(enc)) {
                case 'image':
                    // Pass the URL as the image's href so a failed load (e.g. an
                    // expired CDN link) degrades to a hyperlink via the directive's
                    // onError.
                    return renderImage(
                        enc.href,
                        enc.href,
                        () => el.onImgLoad(),
                        (ev) => el.onImgClick(ev),
                    );
                case 'video':
                    return tplVideo(enc.href, true);
                case 'audio':
                    return tplAudio(enc.href, true, enc.title);
            }
        }
        return html`<a class="social-post__enclosure-link" href="${enc.href}" target="_blank" rel="noopener"
            >${enc.title || enc.href}</a
        >`;
    };
    const enclosures = m.get('enclosures') ?? [];

    // An Atom entry can carry up to three text constructs:
    // <title>, <summary> and <content>
    //
    // A lone construct renders as plain text; a <title> sitting above other constructs
    // becomes a bold heading; a <summary> shown above <content> is italicised,
    // with <content> in normal weight below it.
    const title = m.get('title');
    const summary = m.get('summary');
    const content = m.get('content');
    const title_xhtml = m.get('title_xhtml');
    const summary_xhtml = m.get('summary_xhtml');
    const content_xhtml = m.get('content_xhtml');
    const title_is_heading = !!(title || title_xhtml) && !!(summary || summary_xhtml || content || content_xhtml);

    // The entry's canonical URL (<link rel="alternate">). Surface it as a "Read
    // more" link so news/blog posts whose body is only a teaser stay reachable.
    // Suppress it when the rendered body already links to the same URL (WordPress
    // bridges embed their own "read more" anchor in <content>), to avoid doubling.
    const alternate_url = m.get('alternate_url');
    const body_links_to_source =
        !!alternate_url &&
        [content_xhtml, content, summary_xhtml, summary, title_xhtml].some((s) => s?.includes(alternate_url));

    // Colour the author name per-author
    const color = m.get('color');
    const author_style = color
        ? `color: ${color}`
        : until(
              m.getColor().then((c) => `color: ${c}`),
              '',
          );

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
                <a
                    class="show-msg-author-modal social-post__avatar"
                    @click=${(ev) => el.showProfile(ev)}
                    title="${__('View profile')}"
                    >${avatar}</a
                >
                <div class="social-post__main">
                    <header class="social-post__header">
                        <a
                            class="show-msg-author-modal social-post__author"
                            style="${author_style}"
                            @click=${(ev) => el.showProfile(ev)}
                            >${name}</a
                        >
                        <span class="social-post__jid">${m.get('author_jid')}</span>

                        ${time
                            ? html`<converse-time timestamp="${time}" class="social-post__time"></converse-time>`
                            : ''}
                        ${el.compact
                            ? ''
                            : html`
                                  <button
                                      type="button"
                                      class="social-post__action social-post__action--comment"
                                      title="${__('Comments')}"
                                      aria-label="${__('Comments')}"
                                      @click=${() => el.onComments()}
                                  >
                                      <converse-icon size="1em" class="fa fa-comments"></converse-icon>
                                      ${m.get('comment_count')
                                          ? html`<span class="social-post__count">${m.get('comment_count')}</span>`
                                          : ''}
                                  </button>
                                  <button
                                      type="button"
                                      class="social-post__action social-post__action--like ${m.get('liked_by_me')
                                          ? 'social-post__action--liked'
                                          : ''}"
                                      title="${m.get('liked_by_me') ? __('Unlike') : __('Like')}"
                                      aria-label="${m.get('liked_by_me') ? __('Unlike') : __('Like')}"
                                      aria-pressed="${m.get('liked_by_me') ? 'true' : 'false'}"
                                      ?disabled=${el._liking}
                                      @click=${() => el.onToggleLike()}
                                  >
                                      <converse-icon size="1em" class="fa fa-heart"></converse-icon>
                                      ${m.get('like_count')
                                          ? html`<span class="social-post__count">${m.get('like_count')}</span>`
                                          : ''}
                                  </button>
                                  ${m.get('is_mine')
                                      ? html`<button
                                            type="button"
                                            class="social-post__action social-post__action--delete"
                                            title="${__('Delete')}"
                                            aria-label="${__('Delete')}"
                                            @click=${() => el.onRetract()}
                                        >
                                            <converse-icon size="1em" class="fa fa-trash-alt"></converse-icon>
                                        </button>`
                                      : html`<button
                                            type="button"
                                            class="social-post__action social-post__action--repost"
                                            title="${__('Repost')}"
                                            aria-label="${__('Repost')}"
                                            ?disabled=${el._reposting}
                                            @click=${() => el.onRepost()}
                                        >
                                            <converse-icon size="1em" class="fa fa-retweet"></converse-icon>
                                        </button>`}
                              `}
                    </header>
                    <div class="social-post__body">
                        ${title || title_xhtml
                            ? html`<div
                                  class="social-post__title ${title_is_heading ? 'social-post__title--heading' : ''}"
                              >
                                  ${renderConstruct(title, title_xhtml)}
                              </div>`
                            : ''}
                        ${summary || summary_xhtml
                            ? html`<div class="social-post__summary ${content ? 'social-post__summary--excerpt' : ''}">
                                  ${renderConstruct(summary, summary_xhtml)}
                              </div>`
                            : ''}
                        ${content || content_xhtml
                            ? html`<div class="social-post__content">${renderConstruct(content, content_xhtml)}</div>`
                            : ''}
                        ${enclosures.length
                            ? html`<div class="social-post__media">
                                  ${enclosures.map(
                                      (enc) => html`<div class="social-post__enclosure">${renderEnclosure(enc)}</div>`,
                                  )}
                              </div>`
                            : ''}
                        ${alternate_url && !body_links_to_source
                            ? html`<div class="social-post__source">
                                  <a href="${alternate_url}" target="_blank" rel="noopener noreferrer">
                                      <converse-icon size="0.9em" class="fa fa-external-link-alt"></converse-icon>
                                      <span>${__('Read more')}</span>
                                  </a>
                              </div>`
                            : ''}
                    </div>
                </div>
            </div>
        </article>
    `;
};
