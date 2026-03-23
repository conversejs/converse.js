/**
 * @param {any} s
 * @returns {boolean} - Returns true if the input is a string, otherwise false.
 */
export function isString(s: any): boolean;
/**
 * @param {string} url
 * @returns {boolean}
 */
export function isSpotifyTrack(url: string): boolean;
/**
 * @param {string} url
 * @returns {Promise<Headers>}
 */
export function getHeaders(url: string): Promise<Headers>;
/**
 * We don't render more than two line-breaks, replace extra line-breaks with
 * the zero-width whitespace character
 * This takes into account other characters that may have been removed by
 * being replaced with a zero-width space, such as '> ' in the case of
 * multi-line quotes.
 * @param {string} text
 */
export function collapseLineBreaks(text: string): string;
export function tplMention(o: any): import("lit-html").TemplateResult<1>;
/**
 * @param {import('./texture').Texture} text
 * @param {number} i
 */
export function getDirectiveAndLength(text: import("./texture").Texture, i: number): {
    d: string;
    length: number;
} | {
    d?: undefined;
    length?: undefined;
};
/**
 * @param {string} d
 */
export function isQuoteDirective(d: string): boolean;
/**
 * @param {import('./texture').Texture} text
 * @returns {boolean}
 */
export function containsDirectives(text: import("./texture").Texture): boolean;
/**
 * Detects URL ranges in a text string.
 * @param {string} string - The input string to search for URLs
 * @returns {Array<[number, number]>} - Array of [start, end] index pairs for detected URLs
 */
export function getURLRanges(string: string): Array<[number, number]>;
export function tplMentionWithNick(o: any): import("lit-html").TemplateResult<1>;
declare const _default: {
    getRandomInt: typeof import("headless/types/utils").getRandomInt;
    getUniqueId: typeof import("headless/types/utils").getUniqueId;
    isEmptyMessage: typeof import("headless/types/utils").isEmptyMessage;
    onMultipleEvents: (events: any[], callback: Function) => void;
    prefixMentions: typeof import("headless/types/utils").prefixMentions;
    shouldCreateMessage: (attrs: any) => any;
    triggerEvent: (el: Element, name: string, type?: string, bubbles?: boolean, cancelable?: boolean) => void;
    isValidURL(text: string): boolean;
    getURL(url: string | URL): URL;
    checkFileTypes(types: string[], url: string | URL): boolean;
    isURLWithImageExtension(url: string | URL): boolean;
    isGIFURL(url: string | URL): boolean;
    isAudioURL(url: string | URL, headers?: Headers): boolean;
    isVideoURL(url: string | URL, headers?: Headers): boolean;
    isImageURL(url: string | URL, headers?: Headers): boolean;
    isEncryptedFileURL(url: string | URL): boolean;
    withinString(string: string, callback: Function, options?: import("headless/types/utils/types").ProcessStringOptions): string;
    getHeaders(url: string): Promise<Headers>;
    getMetadataForURL(o: import("headless/types/utils/types").MediaURLIndexes): Promise<import("headless/types/utils/types").MediaURLMetadata>;
    getMediaURLsMetadata(text: string, offset?: number): Promise<{
        media_urls?: import("headless/types/utils/types").MediaURLMetadata[];
    }>;
    getMediaURLs(arr: Array<import("headless/types/utils/types").MediaURLMetadata>, text: string): import("headless/types/utils/types").MediaURLMetadata[];
    addMediaURLsOffset(arr: Array<import("headless/types/utils/types").MediaURLMetadata>, text: string, offset?: number): import("headless/types/utils/types").MediaURLMetadata[];
    firstCharToUpperCase(text: string): string;
    getLongestSubstring(string: string, candidates: string[]): string;
    isString(s: any): boolean;
    getDefaultStorageType(): import("headless/types/utils/types").StorageType;
    createStore(id: string, type: import("headless/types/utils/types").StorageType): import("@converse/skeletor").BrowserStorage;
    initStorage(model: import("headless/types/utils/types").StorageModel, id: string, type?: import("headless/types/utils/types").StorageType): void;
    isErrorStanza(stanza: Element): boolean;
    isForbiddenError(stanza: Element): boolean;
    isServiceUnavailableError(stanza: Element): boolean;
    getAttributes(stanza: Element): object;
    toStanza: typeof import("@converse/headless").Stanza.toElement;
    isUniView(): boolean;
    isTestEnv(): boolean;
    getUnloadEvent(): "pagehide" | "beforeunload" | "unload";
    replacePromise(_converse: ConversePrivateGlobal, name: string): void;
    shouldClearCache(_converse: ConversePrivateGlobal): boolean;
    tearDown(_converse: ConversePrivateGlobal): Promise<any>;
    clearSession(_converse: ConversePrivateGlobal): any;
    debounce(func: Function, timeout: number): (...args: any[]) => void;
    waitUntil(func: Function, max_wait?: number, check_delay?: number): Promise<any>;
    getOpenPromise: typeof import("@converse/openpromise").getOpenPromise;
    merge(dst: any, src: any): void;
    isError(obj: unknown): boolean;
    isFunction(val: unknown): boolean;
    isUndefined(x: unknown): boolean;
    isErrorObject(o: unknown): boolean;
    isPersistableModel(model: import("@converse/skeletor").Model): import("@converse/skeletor").BrowserStorage;
    isEmpty(obj: any | undefined | null): boolean;
    isValidJID(jid?: string | null): boolean;
    isValidMUCJID(jid: string): boolean;
    isSameBareJID(jid1: string, jid2: string): boolean;
    isSameDomain(jid1: string, jid2: string): boolean;
    getJIDFromURI(jid: string): string;
    isOwnJID(jid: string, include_resource?: boolean): boolean;
    maybeAppendDomain(jid: string): string;
    initPlugins(_converse: ConversePrivateGlobal): void;
    initClientConfig(_converse: ConversePrivateGlobal): Promise<void>;
    initSessionStorage(_converse: ConversePrivateGlobal): Promise<void>;
    initPersistentStorage(_converse: ConversePrivateGlobal, store_name: string, key?: string): void;
    setUserJID(jid: string): Promise<string>;
    initSession(_converse: ConversePrivateGlobal, jid: string): Promise<void>;
    registerGlobalEventHandlers(_converse: ConversePrivateGlobal): void;
    cleanup(_converse: ConversePrivateGlobal): Promise<void>;
    attemptNonPreboundSession(credentials?: import("headless/types/utils/types").Credentials, automatic?: boolean): Promise<void>;
    savedLoginInfo(jid: string): Promise<import("@converse/skeletor").Model>;
    safeSave(model: import("@converse/skeletor").Model, attributes: any, options: any): void;
    isElement(el: unknown): boolean;
    isEqualNode(actual: Element, expected: Element): boolean;
    isTagEqual(stanza: Element | typeof import("@converse/headless").Builder, name: string): boolean;
    stringToElement(s: string): Element;
    queryChildren(el: HTMLElement, selector: string): ChildNode[];
    siblingIndex(el: Element): number;
    decodeHTMLEntities(str: string): string;
    unescapeHTML(string: string): string;
    colorize(s: string): Promise<string>;
    appendArrayBuffer(buffer1: any, buffer2: any): ArrayBufferLike;
    arrayBufferToHex(ab: any): any;
    arrayBufferToString(ab: any): string;
    stringToArrayBuffer(string: any): ArrayBufferLike;
    arrayBufferToBase64(ab: any): string;
    base64ToArrayBuffer(b64: any): ArrayBufferLike;
    hexToArrayBuffer(hex: any): ArrayBufferLike;
    unique<T extends unknown>(arr: Array<T>): Array<T>;
} & import("headless/types/utils").CommonUtils & import("headless/types/utils").PluginUtils & {
    getURLRanges: typeof getURLRanges;
};
export default _default;
//# sourceMappingURL=utils.d.ts.map