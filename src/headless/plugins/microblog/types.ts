/**
 * Attributes of a microblog post (a parsed Atom entry). A subset is persisted as
 * an offline cache; the PubSub node remains the source of truth.
 */
export type PubSubMessageAttrs = {
    // Skeletor/BaseMessage bookkeeping
    type: string;
    msgid: string;
    // Omitted when the Atom entry carries no <published>/<updated>; the
    // PubSubMessage then stamps the current time once, at creation.
    time?: string;

    // PubSub identity
    id: string; // The PubSub item id
    node?: string; // The node the item was published to
    from?: string; // JID of the feed (node owner / publishing service)
    // Opaque XEP-0059 RSM cursor of the page whose oldest item this post was, captured
    // from the server's `<first>` and persisted so we can page older than it later.
    rsm_cursor?: string;

    // Atom payload
    body?: string; // Plain-text body: <content>, else <title>, else <summary>
    body_xhtml?: string; // XEP-0071 rich body (inner XHTML), if present
    summary?: string; // Atom <summary> excerpt, if present
    atom_id?: string; // The `tag:` URI from <atom:id>
    author_name?: string;
    author_jid?: string; // Derived from <atom:author><uri>
    publisher?: string; // Server-stamped item @publisher (authoritative)
    published?: string; // ISO8601
    updated?: string; // ISO8601
    categories?: string[]; // <atom:category term>

    // Interaction metadata
    via_jid?: string; // Original author for a repost (<link rel="via">)
    is_repost?: boolean;
    comments_node?: string; // Node referenced by <link rel="replies" title="comments">
};

/**
 * Attributes accepted by {@link buildItem} when composing a new post.
 */
export type PubSubPublishAttrs = {
    body: string;
    id?: string;
    from?: string;
    atom_id?: string;
    published?: string;
    updated?: string;
};

/**
 * Attributes of a {@link PubSubFeed} — one PubSub node at one JID.
 */
export type PubSubFeedAttrs = {
    id: string; // `${jid}/${node}`
    jid: string; // The service/owner JID (bare JID for own PEP)
    node: string; // The PubSub node
    title?: string;
    supports_rsm?: boolean; // Whether the server echoed an RSM `<set>` (else max_items paging)
    history_complete?: boolean; // Whether the oldest post in the node has been loaded
};
