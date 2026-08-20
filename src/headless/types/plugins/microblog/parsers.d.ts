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
//# sourceMappingURL=parsers.d.ts.map