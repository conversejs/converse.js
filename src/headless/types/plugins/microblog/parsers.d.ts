/**
 * Parse a single PubSub `<item>` (or a bare `<entry>`) from a microblog node
 * into a flat attributes object suitable for a {@link PubSubMessage}.
 *
 * @param {Element} item - An `<item>` element (as returned by retrieve-items or a
 *      PEP event), or an `<entry>` element directly.
 * @param {object} [context]
 * @param {string} [context.from] - JID of the feed this item belongs to.
 * @param {string} [context.node] - The PubSub node the item was published to.
 * @returns {import('./types').PubSubMessageAttrs}
 */
export function parseAtomEntry(item: Element, { from, node }?: {
    from?: string;
    node?: string;
}): import("./types").PubSubMessageAttrs;
/**
 * Build a PubSub `<item>` containing an Atom `<entry>` for publishing.
 *
 * For the MVP this produces a minimal plain-text post; `author` is intentionally
 * omitted for own-feed posts (the node owner is implied per XEP-0277). Replies,
 * reposts and rich content are layered on in later milestones.
 *
 * @param {import('./types').PubSubPublishAttrs} attrs
 * @returns {import('strophe.js').Stanza}
 */
export function buildItem(attrs: import("./types").PubSubPublishAttrs): import("strophe.js").Stanza;
//# sourceMappingURL=parsers.d.ts.map