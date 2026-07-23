// The shared rich-composer handle, plus the Social composer's own trigger wrappers
// (see ./lexical-editor.js), so the composer never passes trigger regexes around.
export type LexicalEditor = import('shared/rich-composer/types').RichEditor & {
    getEmojiQuery: () => string | null;
    replaceEmojiTrigger: (query: string, replacement: string) => void;
    getMentionQuery: () => string | null;
    replaceMentionTrigger: (query: string, text: string, url: string) => void;
};

export type SocialRoute = {
    view: 'timeline' | 'profile' | 'post' | 'tag';
    jid?: string; // profile: the author's bare JID
    tab?: 'posts' | 'following'; // profile: which tab (defaults to posts)
    feedJid?: string; // post: the feed's service JID
    node?: string; // post/profile: the feed's node (profile: a non-microblog community feed)
    itemId?: string; // post: the PubSub item id
    tag?: string; // tag: the hashtag, without a leading '#'
};

/**
 * The view-model for one node in the "Browse a service" list — the UI's mirror of
 * the headless `BrowsableFeed` (`api.microblog.browseFeeds`). Kept local because
 * the headless package doesn't re-export its pure data types.
 */
export type BrowsableFeed = {
    jid: string; // The pubsub service JID hosting the node
    node: string; // The node id
    name?: string; // The <item name> from disco#items, if any
    title?: string; // pubsub#title (preferred label; falls back to name/node)
    description?: string; // pubsub#description
    type?: string; // pubsub#type — the payload namespace (Atom for a social feed)
    node_type?: string; // 'leaf' | 'collection', from the pubsub identity
    num_subscribers?: number; // pubsub#num_subscribers, if exposed
    is_feed: boolean; // Whether it looks like an Atom social feed
    probed: boolean; // Whether disco#info was fetched (false past the browse cap)
};

/**
 * The handle returned by `createSocialEditor`. Derived through a type-only dynamic
 * import so the code-split editor module is never statically pulled into the core bundle.
 */
export type EditorHandle = ReturnType<typeof import('./lexical-editor.js').createSocialEditor>;

/**
 * One row of the composer's caret-typeahead menu. `label`/`detail`/`glyph`/`url`
 * drive the shared row template; the remaining fields are set by the source that
 * built the item, for its own `choose` action.
 */
export type TypeaheadItem = {
    label: string; // The row's primary text (a shortname or display name)
    detail?: string; // Secondary muted text (e.g. a mentioned JID)
    glyph?: string; // A unicode emoji glyph rendered before the label
    url?: string; // A custom emoji's image, rendered instead of `glyph`
    jid?: string; // A mention's bare JID
    name?: string; // A mention's display name (the link text, sans `@`)
};
