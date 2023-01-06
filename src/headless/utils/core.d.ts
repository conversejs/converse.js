export function isError(obj: any): boolean;
export function isEmptyMessage(attrs: any): boolean;
export function isUniView(): boolean;
export function tearDown(): Promise<{
    log: {
        setLogLevel(level: number): void;
        log(message: string | Error, level: number, style?: string): void;
        debug(message: any, style: any): void;
        error(message: any, style: any): void;
        info(message: any, style: any): void;
        warn(message: any, style: any): void;
        fatal(message: any, style: any): void;
    };
    CONNECTION_STATUS: typeof import("../shared/constants.js").CONNECTION_STATUS;
    templates: {};
    promises: {
        initialized: any;
    };
    STATUS_WEIGHTS: {
        offline: number;
        unavailable: number;
        xa: number;
        away: number;
        dnd: number;
        chat: number;
        online: number;
    };
    ANONYMOUS: string;
    CLOSED: string;
    EXTERNAL: string;
    LOGIN: string;
    LOGOUT: string;
    OPENED: string;
    PREBIND: string;
    STANZA_TIMEOUT: number;
    SUCCESS: string;
    FAILURE: string;
    DEFAULT_IMAGE_TYPE: string;
    DEFAULT_IMAGE: string;
    TIMEOUTS: {
        PAUSED: number;
        INACTIVE: number;
    };
    INACTIVE: string;
    ACTIVE: string;
    COMPOSING: string;
    PAUSED: string;
    GONE: string;
    PRIVATE_CHAT_TYPE: string;
    CHATROOMS_TYPE: string;
    HEADLINES_TYPE: string;
    CONTROLBOX_TYPE: string;
    default_connection_options: {
        explicitResourceBinding: boolean;
    };
    router: import("@converse/skeletor/src/router.js").Router;
    TimeoutError: typeof import("../shared/errors.js").TimeoutError;
    isTestEnv: () => boolean;
    getDefaultStore: typeof import("./storage.js").getDefaultStore;
    createStore: typeof import("./storage.js").createStore;
    __: (...args: any[]) => any;
    ___: (str: string) => string;
}>;
export function clearSession(): any;
/**
 * Given a message object, return its text with @ chars
 * inserted before the mentioned nicknames.
 */
export function prefixMentions(message: any): any;
export function isValidJID(jid: any): boolean;
/**
 * Merge the second object into the first one.
 * @method u#merge
 * @param { Object } dst
 * @param { Object } src
 */
export function merge(dst: any, src: any): void;
export function safeSave(model: any, attributes: any, options: any): void;
export function getRandomInt(max: any): number;
export function getUniqueId(suffix: any): string;
export function setUnloadEvent(): void;
export function replacePromise(name: any): void;
export function decodeHTMLEntities(str: any): any;
export function saveWindowState(ev: any): void;
declare const _default: {
    getRandomInt: typeof getRandomInt;
    getUniqueId: typeof getUniqueId;
    isEmptyMessage: typeof isEmptyMessage;
    isValidJID: typeof isValidJID;
    merge: typeof merge;
    prefixMentions: typeof prefixMentions;
    saveWindowState: typeof saveWindowState;
    stx: typeof stx;
    toStanza: typeof toStanza;
} & typeof u;
export default _default;
import { stx } from "./stanza.js";
import { toStanza } from "./stanza.js";
declare namespace u {
    export function isTagEqual(stanza: any, name: any): any;
    export function getJIDFromURI(jid: any): any;
    export function getLongestSubstring(string: any, candidates: any): any;
    export function isValidMUCJID(jid: any): boolean;
    export function isSameBareJID(jid1: any, jid2: any): boolean;
    export function isSameDomain(jid1: any, jid2: any): boolean;
    export function isNewMessage(message: any): boolean;
    export function shouldCreateMessage(attrs: any): any;
    export function shouldCreateGroupchatMessage(attrs: any): any;
    export function isChatRoom(model: any): boolean;
    export function isErrorObject(o: any): boolean;
    export function isErrorStanza(stanza: any): boolean;
    export function isForbiddenError(stanza: any): boolean;
    export function isServiceUnavailableError(stanza: any): boolean;
    export function getOuterWidth(el: any, include_margin?: boolean): any;
    /**
     * Converts an HTML string into a DOM element.
     * Expects that the HTML string has only one top-level element,
     * i.e. not multiple ones.
     * @private
     * @method u#stringToElement
     * @param { String } s - The HTML string
     */
    export function stringToElement(s: string): Element;
    /**
     * Checks whether the DOM element matches the given selector.
     * @private
     * @method u#matchesSelector
     * @param { Element } el - The DOM element
     * @param { String } selector - The selector
     */
    export function matchesSelector(el: Element, selector: string): any;
    /**
     * Returns a list of children of the DOM element that match the selector.
     * @private
     * @method u#queryChildren
     * @param { Element } el - the DOM element
     * @param { String } selector - the selector they should be matched against
     */
    export function queryChildren(el: Element, selector: string): ChildNode[];
    export function contains(attr: any, query: any): (item: any) => any;
    export namespace contains {
        function not(attr: any, query: any): (item: any) => boolean;
    }
    export function isOfType(type: any, item: any): boolean;
    export function isInstance(type: any, item: any): boolean;
    export function getAttribute(key: any, item: any): any;
    export function rootContains(root: any, el: any): any;
    export function createFragmentFromText(markup: any): DocumentFragment;
    export function isPersistableModel(model: any): any;
    export { getOpenPromise as getResolveablePromise };
    export { getOpenPromise };
    export function interpolate(string: any, o: any): any;
    /**
     * Call the callback once all the events have been triggered
     * @private
     * @method u#onMultipleEvents
     * @param { Array } events: An array of objects, with keys `object` and
     *   `event`, representing the event name and the object it's triggered upon.
     * @param { Function } callback: The function to call once all events have
     *    been triggered.
     */
    export function onMultipleEvents(events: any[], callback: Function): void;
    export { safeSave };
    export function siblingIndex(el: any): number;
    /**
     * Returns the current word being written in the input element
     * @method u#getCurrentWord
     * @param {HTMLElement} input - The HTMLElement in which text is being entered
     * @param {number} [index] - An optional rightmost boundary index. If given, the text
     *  value of the input element will only be considered up until this index.
     * @param {string} [delineator] - An optional string delineator to
     *  differentiate between words.
     * @private
     */
    export function getCurrentWord(input: HTMLElement, index?: number, delineator?: string): any;
    export function isMentionBoundary(s: any): boolean;
    export function replaceCurrentWord(input: any, new_value: any): void;
    export function triggerEvent(el: any, name: any, type?: string, bubbles?: boolean, cancelable?: boolean): void;
    export function getSelectValues(select: any): any[];
    export function placeCaretAtEnd(textarea: any): void;
    /**
     * Creates a {@link Promise} that resolves if the passed in function returns a truthy value.
     * Rejects if it throws or does not return truthy within the given max_wait.
     * @method u#waitUntil
     * @param {Function} func - The function called every check_delay,
     *  and the result of which is the resolved value of the promise.
     * @param {number} [max_wait=300] - The time to wait before rejecting the promise.
     * @param {number} [check_delay=3] - The time to wait before each invocation of {func}.
     * @returns {Promise} A promise resolved with the value of func,
     *  or rejected with the exception thrown by it or it times out.
     * @copyright Simen Bekkhus 2016
     * @license MIT
     */
    export function waitUntil(func: Function, max_wait?: number, check_delay?: number): Promise<any>;
}
