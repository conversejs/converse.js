/**
 * The set of hashtags a post is tagged with: the inline `#tags` in its body plus
 * its Atom `<category>` terms, lower-cased for case-insensitive matching. Used to
 * filter the timeline to a clicked hashtag.
 * @param {import('@converse/headless').PubSubMessage} post
 * @returns {string[]}
 */
export function getPostHashtags(post: import("@converse/headless").PubSubMessage): string[];
/**
 * Whether a post is tagged with the given hashtag (case-insensitive).
 * @param {import('@converse/headless').PubSubMessage} post
 * @param {string} tag - The tag to match, without the leading `#`.
 * @returns {boolean}
 */
export function postMatchesHashtag(post: import("@converse/headless").PubSubMessage, tag: string): boolean;
/**
 * A post's Atom `<category>` terms that aren't already present as inline
 * `#hashtags` in its body (lower-cased, de-duplicated). Rendered as a tag footer
 * so structured tags published by other clients surface and stay clickable,
 * without repeating the inline hashtags we already render in the body.
 * @param {import('@converse/headless').PubSubMessage} post
 * @returns {string[]}
 */
export function getExtraCategories(post: import("@converse/headless").PubSubMessage): string[];
/**
 * Render a single hashtag as a clickable element. Clicking dispatches a bubbling
 * `hashtagselected` event carrying the tag.
 * @param {string} tag - The tag text, without the leading `#`.
 * @returns {import('lit').TemplateResult}
 */
export function tplHashtag(tag: string): import("lit").TemplateResult;
/**
 * Hook handler for the `afterMessageBodyTransformed` event. Adds hashtag
 * annotations to a {@link import('shared/texture/texture.js').Texture} instance,
 * but only for social posts (which opt in via `render_hashtags`).
 * @param {any} texture - The Texture instance being transformed.
 * @returns {Promise<void>}
 */
export function addHashtagAnnotations(texture: any): Promise<void>;
//# sourceMappingURL=texture.d.ts.map