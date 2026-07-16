/**
 * Attributes of a microblog post (a parsed Atom entry). A subset is persisted as
 * an offline cache; the PubSub node remains the source of truth.
 */
export type PubSubMessageAttrs = {
    type: string;
    msgid: string;
    time?: string;
    id: string;
    node?: string;
    from?: string;
    rsm_cursor?: string;
    atom_id?: string;
    title?: string;
    content?: string;
    summary?: string;
    title_xhtml?: string;
    summary_xhtml?: string;
    content_xhtml?: string;
    enclosures?: Array<{
        href: string;
        type?: string;
        title?: string;
    }>;
    alternate_url?: string;
    author_name?: string;
    author_jid?: string;
    publisher?: string;
    published?: string;
    updated?: string;
    categories?: string[];
    via_jid?: string;
    via_href?: string;
    via_ref?: string;
    is_repost?: boolean;
    comments_jid?: string;
    comments_node?: string;
    comment_count?: number;
    like_count?: number;
    liked_by_me?: boolean;
    my_like_id?: string;
};
/**
 * A media attachment on a post: an Atom `<link rel="enclosure">` (RFC 4287 / XEP-0277).
 */
export type PubSubEnclosure = {
    href: string;
    type?: string;
    title?: string;
};
/**
 * Attributes accepted by {@link PubSubFeed.createPostStanza} when composing a new post.
 */
export type PubSubPublishAttrs = {
    body: string;
    xhtml?: string;
    enclosures?: PubSubEnclosure[];
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
    author_jid: string;
    author_name?: string;
    id?: string;
    published?: string;
};
/**
 * One node returned by browsing a pubsub service (`api.microblog.browseFeeds`):
 * a `{ jid, node }` address plus the disco#info meta-data we could read for it.
 */
export type BrowsableFeed = {
    jid: string;
    node: string;
    name?: string;
    title?: string;
    description?: string;
    type?: string;
    node_type?: string;
    num_subscribers?: number;
    is_feed: boolean;
    probed: boolean;
};
/**
 * One page of results from `api.microblog.browseFeeds`: the probed nodes plus the
 * paging state a caller needs to fetch the next page (or explain a truncated one).
 */
export type BrowseFeedsResult = {
    feeds: BrowsableFeed[];
    cursor: string | null;
    has_more: boolean;
};
/**
 * Attributes of a {@link PubSubFeed} — one PubSub node at one JID.
 */
export type PubSubFeedAttrs = {
    id: string;
    jid: string;
    node: string;
    title?: string;
    supports_rsm?: boolean;
    history_complete?: boolean;
    last_viewed?: number;
    pinned?: boolean;
};
//# sourceMappingURL=types.d.ts.map