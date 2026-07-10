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
    author_jid: string;
    author_name?: string;
    id?: string;
    published?: string;
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