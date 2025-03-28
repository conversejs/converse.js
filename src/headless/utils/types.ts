export type Credentials = {
    jid: string;
    password: string;
};

export type ProcessStringOptions = {
    start?: RegExp;
    end?: RegExp;
    trim?: RegExp;
    parens?: RegExp;
    ignoreHtml?: boolean;
    ignore?: RegExp;
};

export type MediaURLMetadata = {
    is_audio?: boolean;
    is_encrypted?: boolean;
    is_gif?: boolean;
    is_image?: boolean;
    is_video?: boolean;
    content_type?: string;
    end?: number;
    start?: number;
    url: string;
};
