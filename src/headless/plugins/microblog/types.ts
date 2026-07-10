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
    summary_xhtml?: string;
    content_xhtml?: string;

    // RFC 4287 media attachments (<link rel="enclosure">)
    enclosures?: Array<{ href: string; type?: string; title?: string }>;

    // The entry's canonical web URL (<link rel="alternate">) — an article permalink
    // for blog/news feeds whose body is only a teaser.
    alternate_url?: string;

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
    comments_jid?: string; // Service JID of the comments node's <link rel="replies"> href
    comments_node?: string; // Node referenced by <link rel="replies" title="comments">

    // Denormalised comment-thread summary (XEP-0277 § Comments), synced from the
    // post's CommentFeed by syncCommentSummary so the timeline can show counts
    // without opening the thread. A cache; the comments node stays the source.
    comment_count?: number; // Number of non-♥ comment items
    like_count?: number; // Number of ♥ (like) items
    liked_by_me?: boolean; // Whether one of the ♥ items is ours
    my_like_id?: string; // That ♥ item's id, needed to retract on un-like
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
 * Attributes accepted by {@link CommentFeed.createCommentStanza} when composing a
 * new comment (XEP-0277 § Adding a Comment).
 */
export type PubSubCommentAttrs = {
    body: string;
    author_jid: string; // The commenter's bare JID (goes in <author><uri>)
    author_name?: string; // The commenter's display name (<author><name>)
    id?: string;
    published?: string;
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

    // Comment-thread bookkeeping (CommentFeed / CommentFeeds):
    last_viewed?: number; // Epoch ms of last explicit access, for LRU eviction
    pinned?: boolean; // Exempt from LRU eviction (own posts, subscribed for live updates)
};
