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
export function isErrorObject(o: any): o is Error;
export function safeSave(model: any, attributes: any, options: any): void;
export function getRandomInt(max: any): number;
/**
 * @param {string} [suffix]
 * @return {string}
 */
export function getUniqueId(suffix?: string): string;
declare const _default: {
    getLongestSubstring: typeof getLongestSubstring;
    getOpenPromise: any;
    getRandomInt: typeof getRandomInt;
    getUniqueId: typeof getUniqueId;
    isEmptyMessage: typeof isEmptyMessage;
    isErrorObject: typeof isErrorObject;
    onMultipleEvents: typeof onMultipleEvents;
    prefixMentions: typeof prefixMentions;
    safeSave: typeof safeSave;
    shouldCreateMessage: typeof shouldCreateMessage;
    toStanza: typeof toStanza;
    triggerEvent: typeof triggerEvent;
    waitUntil: typeof waitUntil;
    isValidURL(text: string): boolean;
    getURI(url: string | getOpenPromise): any;
    checkFileTypes(types: string[], url: string): boolean;
    filterQueryParamsFromURL(url: any): any;
    isURLWithImageExtension(url: any): boolean;
    isGIFURL(url: any): boolean;
    isAudioURL(url: any): boolean;
    isVideoURL(url: any): boolean;
    isImageURL(url: any): any;
    isEncryptedFileURL(url: any): any;
    getMediaURLsMetadata(text: string, offset?: number): {
        media_urls?: MediaURLMetadata[];
    };
    getMediaURLs(arr: Array<MediaURLMetadata>, text: string, offset?: number): MediaURLData[];
    getDefaultStore(): "session" | "persistent";
    createStore(id: any, store: any): any;
    initStorage(model: any, id: any, type: any): void;
    isErrorStanza(stanza: Element): boolean;
    isForbiddenError(stanza: Element): boolean;
    isServiceUnavailableError(stanza: Element): boolean;
    getAttributes(stanza: Element): object;
    isUniView(): boolean;
    isTestEnv(): boolean;
    getUnloadEvent(): "pagehide" | "beforeunload" | "unload";
    replacePromise(_converse: ConversePrivateGlobal, name: string): void;
    shouldClearCache(_converse: ConversePrivateGlobal): boolean;
    tearDown(_converse: ConversePrivateGlobal): Promise<any>;
    clearSession(_converse: ConversePrivateGlobal): any;
    merge(dst: any, src: any): void;
    isError(obj: any): boolean;
    isFunction(val: any): boolean;
    isValidJID(jid: any): boolean;
    isValidMUCJID(jid: any): boolean;
    isSameBareJID(jid1: any, jid2: any): boolean;
    isSameDomain(jid1: any, jid2: any): boolean;
    getJIDFromURI(jid: string): string;
    isElement(el: unknown): boolean;
    isTagEqual(stanza: Element | typeof import("strophe.js").Builder, name: string): boolean;
    stringToElement(s: string): Element;
    queryChildren(el: HTMLElement, selector: string): ChildNode[];
    siblingIndex(el: Element): number;
    decodeHTMLEntities(str: string): string;
    getSelectValues(select: HTMLSelectElement): string[];
    webForm2xForm(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): Element;
    getCurrentWord(input: HTMLInputElement, index?: number, delineator?: string | RegExp): string;
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
} & CommonUtils & PluginUtils;
export default _default;
export type CommonUtils = Record<string, Function>;
/**
 * The utils object
 */
export type PluginUtils = Record<"muc" | "mam", CommonUtils>;
declare function getLongestSubstring(string: any, candidates: any): any;
/**
 * Call the callback once all the events have been triggered
 * @param { Array } events: An array of objects, with keys `object` and
 *   `event`, representing the event name and the object it's triggered upon.
 * @param { Function } callback: The function to call once all events have
 *    been triggered.
 */
declare function onMultipleEvents(events: any[], callback: Function): void;
declare function shouldCreateMessage(attrs: any): any;
import { toStanza } from 'strophe.js';
/**
 * @param {Element} el
 * @param {string} name
 * @param {string} [type]
 * @param {boolean} [bubbles]
 * @param {boolean} [cancelable]
 */
declare function triggerEvent(el: Element, name: string, type?: string, bubbles?: boolean, cancelable?: boolean): void;
import { waitUntil } from './promise.js';
import * as url from './url.js';
import * as session from './session.js';
//# sourceMappingURL=index.d.ts.map