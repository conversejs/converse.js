export type BookmarkAttrs = {
    jid: string;
    name?: string;
    autojoin?: boolean;
    nick?: string;
    password?: string;
    extensions: string[];
};
export type SetBookmarkOptions = import('@converse/skeletor').FetchOrCreateOptions & {
    keep_on_error?: boolean;
};
//# sourceMappingURL=types.d.ts.map