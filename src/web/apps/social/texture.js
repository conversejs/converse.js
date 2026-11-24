/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Social-specific rich-text rendering. We render post bodies with the shared
 * `converse-texture` pipeline (URLs, media, emojis, XEP-0393 styling) and add
 * **hashtags** as an extra rich element.
 */
import { html } from 'lit';

// A hashtag: `#` at a word boundary, followed by a letter then word characters
// (Unicode letters/digits/underscore). Hashtags inside URLs never reach us — the
// hyperlink annotations run first, so by the time we annotate the remaining
// plaintext those ranges are already templated out.
const HASHTAG_REGEX = /(?<![\p{L}\p{N}_])#(\p{L}[\p{L}\p{N}_]*)/gu;

/**
 * The set of hashtags a post is tagged with: the inline `#tags` in its body plus
 * its Atom `<category>` terms, lower-cased for case-insensitive matching. Used to
 * filter the timeline to a clicked hashtag.
 * @param {import('@converse/headless').PubSubMessage} post
 * @returns {string[]}
 */
export function getPostHashtags(post) {
    const tags = new Set();
    // Scan all three Atom text constructs (<title>/<summary>/<content>).
    const text = [post.get('title'), post.get('summary'), post.get('content')].filter(Boolean).join('\n');
    for (const m of text.matchAll(HASHTAG_REGEX)) {
        tags.add(m[1].toLowerCase());
    }
    for (const category of post.get('categories') ?? []) {
        if (category) tags.add(String(category).toLowerCase());
    }
    return Array.from(tags);
}

/**
 * Whether a post is tagged with the given hashtag (case-insensitive).
 * @param {import('@converse/headless').PubSubMessage} post
 * @param {string} tag - The tag to match, without the leading `#`.
 * @returns {boolean}
 */
export function postMatchesHashtag(post, tag) {
    return !!tag && getPostHashtags(post).includes(tag.toLowerCase());
}

/**
 * A post's Atom `<category>` terms that aren't already present as inline
 * `#hashtags` in its body (lower-cased, de-duplicated). Rendered as a tag footer
 * so structured tags published by other clients surface and stay clickable,
 * without repeating the inline hashtags we already render in the body.
 * @param {import('@converse/headless').PubSubMessage} post
 * @returns {string[]}
 */
export function getExtraCategories(post) {
    const inline = new Set();
    const text = [post.get('title'), post.get('summary'), post.get('content')].filter(Boolean).join('\n');
    for (const m of text.matchAll(HASHTAG_REGEX)) inline.add(m[1].toLowerCase());

    const extra = [];
    const seen = new Set();
    for (const category of post.get('categories') ?? []) {
        const tag = String(category).toLowerCase();
        if (tag && !inline.has(tag) && !seen.has(tag)) {
            seen.add(tag);
            extra.push(tag);
        }
    }
    return extra;
}

/**
 * Render a single hashtag as a clickable element. Clicking dispatches a bubbling
 * `hashtagselected` event carrying the tag.
 * @param {string} tag - The tag text, without the leading `#`.
 * @returns {import('lit').TemplateResult}
 */
export function tplHashtag(tag) {
    return html`<a
        class="social-post__hashtag"
        role="button"
        @click=${(/** @type {MouseEvent} */ ev) => {
            ev.preventDefault();
            /** @type {Element} */ (ev.target).dispatchEvent(
                new CustomEvent('hashtagselected', { bubbles: true, composed: true, detail: { tag } }),
            );
        }}
        >#${tag}</a
    >`;
}

/**
 * Hook handler for the `afterMessageBodyTransformed` event. Adds hashtag
 * annotations to a {@link import('shared/texture/texture.js').Texture} instance,
 * but only for social posts (which opt in via `render_hashtags`).
 * @param {any} texture - The Texture instance being transformed.
 * @returns {Promise<void>}
 */
export async function addHashtagAnnotations(texture) {
    if (!texture?.options?.render_hashtags) return;
    await texture.addAnnotations((/** @type {string} */ text, /** @type {number} */ offset) => {
        for (const m of text.matchAll(HASHTAG_REGEX)) {
            texture.addTemplateResult(m.index + offset, m.index + offset + m[0].length, tplHashtag(m[1]));
        }
    });
}
