export type ProcessStringOptions = {
    start?: RegExp;
    end?: RegExp;
    trim?: RegExp;
    parens?: RegExp;
    ignoreHtml?: boolean;
    ignore?: RegExp;
};
export type MediaURLIndexes = {
    url: string;
    end: number;
    start: number;
};
export type MediaURLMetadata = MediaURLIndexes & {
    is_audio?: boolean;
    is_encrypted?: boolean;
    is_gif?: boolean;
    is_image?: boolean;
    is_video?: boolean;
};
//# sourceMappingURL=types.d.ts.map