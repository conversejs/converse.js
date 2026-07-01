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
    body?: string;
    body_xhtml?: string;
    summary?: string;
    atom_id?: string;
    author_name?: string;
    author_jid?: string;
    publisher?: string;
    published?: string;
    updated?: string;
    categories?: string[];
    via_jid?: string;
    is_repost?: boolean;
    comments_node?: string;
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
    id: string;
    jid: string;
    node: string;
    title?: string;
    supports_rsm?: boolean;
    history_complete?: boolean;
};
//# sourceMappingURL=types.d.ts.map