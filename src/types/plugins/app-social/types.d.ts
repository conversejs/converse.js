export type LexicalEditor = {
    editor: import('lexical').LexicalEditor;
    getMarkdown: () => string;
    getHtml: () => string;
    isEmpty: () => boolean;
    insertText: (text: string) => void;
    format: (type: import('lexical').TextFormatType) => boolean;
    getEmojiQuery: () => string | null;
    replaceEmojiTrigger: (query: string, replacement: string) => void;
    clear: () => void;
    focus: () => void;
    destroy: () => void;
};
export type SocialRoute = {
    view: 'timeline' | 'profile' | 'post' | 'tag';
    jid?: string;
    tab?: 'posts' | 'following';
    feedJid?: string;
    node?: string;
    itemId?: string;
    tag?: string;
};
/**
 * The view-model for one node in the "Browse a service" list — the UI's mirror of
 * the headless `BrowsableFeed` (`api.microblog.browseFeeds`). Kept local because
 * the headless package doesn't re-export its pure data types.
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
 * The handle returned by `createSocialEditor`. Derived through a type-only dynamic
 * import so the code-split editor module is never statically pulled into the core bundle.
 */
export type EditorHandle = ReturnType<typeof import('./lexical-editor.js').createSocialEditor>;
//# sourceMappingURL=types.d.ts.map