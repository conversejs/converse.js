/**
 * Attributes of a microblog post (a parsed Atom entry). A subset is persisted as
 * an offline cache; the PubSub node remains the source of truth.
 */
export type PubSubMessageAttrs = {
    type: string;
    msgid: string;
    time?: string;

    id: string; // The PubSub item id
    node?: string; // The node the item was published to
    from?: string; // JID of the feed (node owner / publishing service)

    // Opaque XEP-0059 RSM cursor of the page whose oldest item this post was, captured
    // from the server's RSM `<first>` value and persisted so we can page older than it later.
    rsm_cursor?: string;

    atom_id?: string; // The `tag:` URI from <atom:id>

    // An Atom entry can carry up to three text constructs:
    //  - <title> XEP-0277 short posts put the whole post here
    //  - <summary> An excerpt
    //  - <content> Full body. Atom-native feeds use this, often with an empty <title>.
    title?: string;
    content?: string;
    summary?: string;

    title_xhtml?: string;
    content_xhtml?: string;

    author_name?: string;
    author_jid?: string; // Derived from <atom:author><uri>
    publisher?: string; // Server-stamped item @publisher (authoritative)
    published?: string; // ISO8601
    updated?: string; // ISO8601
    categories?: string[]; // <atom:category term>

    // Interaction metadata
    via_jid?: string; // Original author for a repost (<link rel="via">)
    via_href?: string; // The via link's href — the original post's XMPP URI
    via_ref?: string; // The via link's ref — the original post's atom id
    is_repost?: boolean;
    comments_node?: string; // Node referenced by <link rel="replies" title="comments">
};

/**
 * Attributes accepted by {@link PubSubFeed.createPostStanza} when composing a new post.
 */
export type PubSubPublishAttrs = {
    body: string;
    id?: string;
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
