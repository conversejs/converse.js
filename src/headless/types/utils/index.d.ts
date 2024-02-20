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
export function isErrorObject(o: any): boolean;
export function safeSave(model: any, attributes: any, options: any): void;
export function getRandomInt(max: any): number;
/**
 * @param {string} [suffix]
 * @return {string}
 */
export function getUniqueId(suffix?: string): string;
declare const _default: {
    arrayBufferToBase64: typeof arrayBufferToBase64;
    arrayBufferToHex: typeof arrayBufferToHex;
    arrayBufferToString: typeof arrayBufferToString;
    base64ToArrayBuffer: typeof base64ToArrayBuffer;
    checkFileTypes: typeof checkFileTypes;
    createStore: typeof createStore;
    getCurrentWord: typeof getCurrentWord;
    getDefaultStore: typeof getDefaultStore;
    getLongestSubstring: typeof getLongestSubstring;
    getOpenPromise: any;
    getOuterWidth: typeof getOuterWidth;
    getRandomInt: typeof getRandomInt;
    getSelectValues: typeof getSelectValues;
    getURI: typeof getURI;
    getUniqueId: typeof getUniqueId;
    isAllowedProtocolForMedia: typeof isAllowedProtocolForMedia;
    isAudioURL: typeof isAudioURL;
    isElement: typeof isElement;
    isEmptyMessage: typeof isEmptyMessage;
    isError: typeof isError;
    isErrorObject: typeof isErrorObject;
    isErrorStanza: typeof isErrorStanza;
    isFunction: typeof isFunction;
    isGIFURL: typeof isGIFURL;
    isImageURL: typeof isImageURL;
    isMentionBoundary: typeof isMentionBoundary;
    isSameBareJID: typeof isSameBareJID;
    isTagEqual: typeof isTagEqual;
    isURLWithImageExtension: typeof isURLWithImageExtension;
    isValidJID: typeof isValidJID;
    isValidMUCJID: typeof isValidMUCJID;
    isVideoURL: typeof isVideoURL;
    merge: typeof merge;
    onMultipleEvents: typeof onMultipleEvents;
    placeCaretAtEnd: typeof placeCaretAtEnd;
    prefixMentions: typeof prefixMentions;
    queryChildren: typeof queryChildren;
    replaceCurrentWord: typeof replaceCurrentWord;
    safeSave: typeof safeSave;
    shouldClearCache: typeof shouldClearCache;
    shouldCreateMessage: typeof shouldCreateMessage;
    shouldRenderMediaFromURL: typeof shouldRenderMediaFromURL;
    stringToArrayBuffer: typeof stringToArrayBuffer;
    stringToElement: typeof stringToElement;
    toStanza: typeof toStanza;
    triggerEvent: typeof triggerEvent;
    webForm2xForm: typeof webForm2xForm;
    waitUntil: typeof waitUntil;
} & Record<string, Function>;
export default _default;
import { arrayBufferToBase64 } from "./arraybuffer.js";
import { arrayBufferToHex } from "./arraybuffer.js";
import { arrayBufferToString } from "./arraybuffer.js";
import { base64ToArrayBuffer } from "./arraybuffer.js";
import { checkFileTypes } from "./url.js";
import { createStore } from "./storage.js";
import { getCurrentWord } from "./form.js";
import { getDefaultStore } from "./storage.js";
declare function getLongestSubstring(string: any, candidates: any): any;
import { getOuterWidth } from "./html.js";
import { getSelectValues } from "./form.js";
import { getURI } from "./url.js";
import { isAllowedProtocolForMedia } from "./url.js";
import { isAudioURL } from "./url.js";
import { isElement } from "./html.js";
import { isError } from "./object.js";
import { isErrorStanza } from "./stanza.js";
import { isFunction } from "./object.js";
import { isGIFURL } from "./url.js";
import { isImageURL } from "./url.js";
import { isMentionBoundary } from "./form.js";
import { isSameBareJID } from "./jid.js";
import { isTagEqual } from "./html.js";
import { isURLWithImageExtension } from "./url.js";
import { isValidJID } from "./jid.js";
import { isValidMUCJID } from "./jid.js";
import { isVideoURL } from "./url.js";
import { merge } from "./object.js";
/**
 * Call the callback once all the events have been triggered
 * @param { Array } events: An array of objects, with keys `object` and
 *   `event`, representing the event name and the object it's triggered upon.
 * @param { Function } callback: The function to call once all events have
 *    been triggered.
 */
declare function onMultipleEvents(events: any[], callback: Function): void;
import { placeCaretAtEnd } from "./form.js";
import { queryChildren } from "./html.js";
import { replaceCurrentWord } from "./form.js";
import { shouldClearCache } from "./session.js";
declare function shouldCreateMessage(attrs: any): any;
import { shouldRenderMediaFromURL } from "./url.js";
import { stringToArrayBuffer } from "./arraybuffer.js";
import { stringToElement } from "./html.js";
import { toStanza } from "strophe.js";
/**
 * @param {Element} el
 * @param {string} name
 * @param {string} [type]
 * @param {boolean} [bubbles]
 * @param {boolean} [cancelable]
 */
declare function triggerEvent(el: Element, name: string, type?: string, bubbles?: boolean, cancelable?: boolean): void;
import { webForm2xForm } from "./form.js";
import { waitUntil } from "./promise.js";
//# sourceMappingURL=index.d.ts.map