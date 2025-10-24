import { BrowserStorage, IEventEmitter } from "@converse/skeletor";

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

export type MediaURLIndexes = {
    url: string;
    end: number;
    start: number;
}

export type MediaURLMetadata = MediaURLIndexes & {
    is_audio?: boolean;
    is_encrypted?: boolean;
    is_gif?: boolean;
    is_image?: boolean;
    is_video?: boolean;
};

export type StorageType = 'persistent' | 'session';

export type StorageModel = IEventEmitter & {
    browserStorage: BrowserStorage;
}
