import { PersistentStorage, IEventEmitter } from '@converse/skeletor';

export type CommonUtils = Record<string, (...args: any[]) => any>;

type PluginUtilsKeys = 'muc' | 'mam' | 'omemo' | 'roster' | 'reactions' | 'bookmarks' | 'emojis' | 'jingle';

export type PluginUtils = Record<PluginUtilsKeys, CommonUtils>;

export type Credentials = {
    jid: string;
    password: string;
    renewable?: boolean; // Set by a source whose credentials can be replaced if the server rejects them
};

// The payload of the `beforeAttemptNonPreboundSession` hook, through which
// credential sources supply the credentials to log in with.
export type CredentialsHookPayload = {
    credentials?: Credentials | null; // Passed in, or supplied by an earlier listener
    automatic?: boolean; // Whether Converse logs in by itself, for example at start-up
};

// The payload of the `fallbackLoginCredentials` hook, through which credential
// sources of last resort supply the credentials to log in with.
export type FallbackCredentialsHookPayload = CredentialsHookPayload & {
    unattended?: boolean; // Whether the user must not be asked, since a remembered session is being resumed
    jid?: string; // The remembered account's bare JID, if `unattended`
};

// The payload of the `unattendedLogin` hook, which asks whether the
// remembered account can log in again without the user.
export type UnattendedLoginPayload = {
    jid: string; // The remembered account's bare JID
    named: boolean; // Whether the start-up named that account, through the `jid` setting or the login API
    can_log_in: boolean; // Set if Converse or a credential source can log the account in
    veto: boolean; // Set if the session must not be resumed, whoever can log it in
    credentials?: Credentials | null; // Credentials a listener obtained while answering, to log in with
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
};

export type MediaURLMetadata = MediaURLIndexes & {
    is_audio?: boolean;
    is_encrypted?: boolean;
    is_gif?: boolean;
    is_image?: boolean;
    is_video?: boolean;
    is_webp?: boolean;
};

export type StorageType = 'persistent' | 'session';

export type StorageModel = IEventEmitter & {
    storage: PersistentStorage;
};

/**
 * The subset of the browser extension storage area API used by the extension
 * localForage drivers. Methods return a promise (`browser.storage`) or take a
 * callback (`chrome.storage`).
 */
export type ExtensionStorageArea = {
    get: (keys: string | string[] | null, callback?: (items: Record<string, any>) => void) => any;
    set: (items: Record<string, any>, callback?: () => void) => any;
    remove: (keys: string | string[], callback?: () => void) => any;
    clear: (callback?: () => void) => any;
};
