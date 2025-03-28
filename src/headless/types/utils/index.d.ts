/**
 * @param {Event} [event]
 */
export function setLogLevelFromRoute(event?: Event): void;
export function isEmptyMessage(attrs: any): boolean;
/**
 * Given a message object, return its text with @ chars
 * inserted before the mentioned nicknames.
 */
export function prefixMentions(message: any): any;
export function getRandomInt(max: any): number;
/**
 * @param {string} [suffix]
 * @return {string}
 */
export function getUniqueId(suffix?: string): string;
declare const _default: {
    getRandomInt: typeof getRandomInt;
    getUniqueId: typeof getUniqueId;
    isEmptyMessage: typeof isEmptyMessage;
    onMultipleEvents: typeof onMultipleEvents;
    prefixMentions: typeof prefixMentions;
    shouldCreateMessage: typeof shouldCreateMessage;
    triggerEvent: typeof triggerEvent;
    isValidURL(text: string): boolean;
    getURL(url: string | URL): URL;
    checkFileTypes(types: string[], url: string | URL): boolean;
    isURLWithImageExtension(url: string | URL): boolean;
    isGIFURL(url: string | URL): boolean;
    isAudioURL(url: string | URL): boolean;
    isVideoURL(url: string | URL): boolean;
    isImageURL(url: string | URL): boolean;
    isEncryptedFileURL(url: string | URL): boolean;
    withinString(string: string, callback: Function, options?: import("./types.js").ProcessStringOptions): string;
    getMediaURLsMetadata(text: string, offset?: number): {
        media_urls?: import("./types.js").MediaURLMetadata[];
    };
    getMediaURLs(arr: Array<import("./types.js").MediaURLMetadata>, text: string): import("./types.js").MediaURLMetadata[];
    addMediaURLsOffset(arr: Array<import("./types.js").MediaURLMetadata>, text: string, offset?: number): import("./types.js").MediaURLMetadata[];
    firstCharToUpperCase(text: string): string;
    getLongestSubstring(string: string, candidates: string[]): string;
    isString(s: any): boolean;
    getDefaultStore(): "session" | "persistent";
    createStore(id: any, store: any): any;
    initStorage(model: any, id: any, type: any): void;
    isErrorStanza(stanza: Element): boolean;
    isForbiddenError(stanza: Element): boolean;
    isServiceUnavailableError(stanza: Element): boolean;
    getAttributes(stanza: Element): object;
    toStanza: typeof import("strophe.js").Stanza.toElement;
    isUniView(): boolean;
    isTestEnv(): boolean;
    getUnloadEvent(): "pagehide" | "beforeunload" | "unload";
    replacePromise(_converse: ConversePrivateGlobal, name: string): void;
    shouldClearCache(_converse: ConversePrivateGlobal): boolean;
    tearDown(_converse: ConversePrivateGlobal): Promise<any>;
    clearSession(_converse: ConversePrivateGlobal): any;
    waitUntil(func: Function, max_wait?: number, check_delay?: number): Promise<any>;
    getOpenPromise: any;
    merge(dst: any, src: any): void;
    isError(obj: unknown): boolean;
    isFunction(val: unknown): boolean;
    isUndefined(x: unknown): boolean;
    isErrorObject(o: unknown): boolean;
    isPersistableModel(model: import("@converse/skeletor").Model): boolean;
    isValidJID(jid?: string | null): boolean;
    isValidMUCJID(jid: string): boolean;
    isSameBareJID(jid1: string, jid2: string): boolean;
    isSameDomain(jid1: string, jid2: string): boolean;
    getJIDFromURI(jid: string): string;
    initPlugins(_converse: ConversePrivateGlobal): void;
    initClientConfig(_converse: ConversePrivateGlobal): Promise<void>;
    initSessionStorage(_converse: ConversePrivateGlobal): Promise<void>;
    initPersistentStorage(_converse: ConversePrivateGlobal, store_name: string, key?: string): void;
    setUserJID(jid: string): Promise<string>;
    initSession(_converse: ConversePrivateGlobal, jid: string): Promise<void>;
    registerGlobalEventHandlers(_converse: ConversePrivateGlobal): void;
    cleanup(_converse: ConversePrivateGlobal): Promise<void>;
    attemptNonPreboundSession(credentials?: import("./types.js").Credentials, automatic?: boolean): Promise<void>;
    savedLoginInfo(jid: string): Promise<Model>;
    safeSave(model: Model, attributes: any, options: any): void;
    isElement(el: unknown): boolean;
    isTagEqual(stanza: Element | typeof import("strophe.js").Builder, name: string): boolean;
    stringToElement(s: string): Element;
    queryChildren(el: HTMLElement, selector: string): ChildNode[];
    siblingIndex(el: Element): number;
    decodeHTMLEntities(str: string): string;
    getSelectValues(select: HTMLSelectElement): string[];
    webForm2xForm(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): Element;
    getCurrentWord(input: HTMLInputElement | HTMLTextAreaElement, index?: number, delineator?: string | RegExp): string;
    isMentionBoundary(s: string): boolean;
    replaceCurrentWord(input: HTMLInputElement, new_value: string): void;
    placeCaretAtEnd(textarea: HTMLTextAreaElement): void;
    colorize(s: string): Promise<string>;
    appendArrayBuffer(buffer1: any, buffer2: any): ArrayBufferLike;
    arrayBufferToHex(ab: any): any;
    arrayBufferToString(ab: any): string;
    stringToArrayBuffer(string: any): ArrayBufferLike;
    arrayBufferToBase64(ab: any): string;
    base64ToArrayBuffer(b64: any): ArrayBufferLike;
    hexToArrayBuffer(hex: any): ArrayBufferLike;
    unique<T extends unknown>(arr: Array<T>): Array<T>;
} & CommonUtils & PluginUtils;
export default _default;
export type CommonUtils = Record<string, Function>;
/**
 * The utils object
 */
export type PluginUtils = Record<"muc" | "mam", CommonUtils>;
/**
 * Call the callback once all the events have been triggered
 * @param { Array } events: An array of objects, with keys `object` and
 *   `event`, representing the event name and the object it's triggered upon.
 * @param { Function } callback: The function to call once all events have
 *    been triggered.
 */
declare function onMultipleEvents(events: any[], callback: Function): void;
declare function shouldCreateMessage(attrs: any): any;
/**
 * @param {Element} el
 * @param {string} name
 * @param {string} [type]
 * @param {boolean} [bubbles]
 * @param {boolean} [cancelable]
 */
declare function triggerEvent(el: Element, name: string, type?: string, bubbles?: boolean, cancelable?: boolean): void;
import * as session from './session.js';
import { Model } from '@converse/skeletor';
import * as init from './init.js';
//# sourceMappingURL=index.d.ts.map