/**
 * Extract the XEP-0359 stanza IDs from the passed in stanza
 * and return a map containing them.
 * @param {Element} stanza - The message stanza
 * @param {Element} original_stanza - The encapsulating stanza which contains
 *      the message stanza.
 * @returns {Object}
 */
export function getStanzaIDs(stanza: Element, original_stanza: Element): any;
/**
 * @param {Element} stanza
 */
export function getEncryptionAttributes(stanza: Element): {
    is_encrypted: boolean;
    encryption_namespace: any;
};
/**
 * @private
 * @param { Element } stanza - The message stanza
 * @param { Element } original_stanza - The original stanza, that contains the
 *  message stanza, if it was contained, otherwise it's the message stanza itself.
 * @returns { Object }
 */
export function getRetractionAttributes(stanza: Element, original_stanza: Element): any;
export function getCorrectionAttributes(stanza: any, original_stanza: any): {
    replace_id: any;
    edited: string;
} | {
    replace_id?: undefined;
    edited?: undefined;
};
export function getOpenGraphMetadata(stanza: any): any;
export function getSpoilerAttributes(stanza: any): {
    is_spoiler: boolean;
    spoiler_hint: any;
};
export function getOutOfBandAttributes(stanza: any): {
    oob_url: any;
    oob_desc: any;
} | {
    oob_url?: undefined;
    oob_desc?: undefined;
};
/**
 * Returns the human readable error message contained in a `groupchat` message stanza of type `error`.
 * @private
 * @param { Element } stanza - The message stanza
 */
export function getErrorAttributes(stanza: Element): {
    is_error: boolean;
    error_text: any;
    error_type: string;
    error_condition: string;
} | {
    is_error?: undefined;
    error_text?: undefined;
    error_type?: undefined;
    error_condition?: undefined;
};
/**
 * Given a message stanza, find and return any XEP-0372 references
 * @param {Element} stanza - The message stanza
 * @returns { Reference }
 */
export function getReferences(stanza: Element): any;
/**
 * @param {Element} stanza
 */
export function getReceiptId(stanza: Element): any;
/**
 * Determines whether the passed in stanza is a XEP-0280 Carbon
 * @private
 * @param { Element } stanza - The message stanza
 * @returns { Boolean }
 */
export function isCarbon(stanza: Element): boolean;
/**
 * Returns the XEP-0085 chat state contained in a message stanza
 * @private
 * @param { Element } stanza - The message stanza
 */
export function getChatState(stanza: Element): any;
export function isValidReceiptRequest(stanza: any, attrs: any): any;
/**
 * Check whether the passed-in stanza is a forwarded message that is "bare",
 * i.e. it's not forwarded as part of a larger protocol, like MAM.
 * @param { Element } stanza
 */
export function throwErrorIfInvalidForward(stanza: Element): void;
/**
 * Determines whether the passed in stanza is a XEP-0333 Chat Marker
 * @method getChatMarker
 * @param {Element} stanza - The message stanza
 * @returns {Element}
 */
export function getChatMarker(stanza: Element): Element;
/**
 * @param {Element} stanza
 */
export function isHeadline(stanza: Element): boolean;
/**
 * @param {Element} stanza
 */
export function isServerMessage(stanza: Element): boolean;
/**
 * Determines whether the passed in stanza is a XEP-0313 MAM stanza
 * @method isArchived
 * @param {Element} original_stanza - The message stanza
 * @returns {boolean}
 */
export function isArchived(original_stanza: Element): boolean;
export class StanzaParseError extends Error {
    /**
     * @param {string} message
     * @param {Element} stanza
     */
    constructor(message: string, stanza: Element);
    stanza: Element;
}
export type Reference = any;
//# sourceMappingURL=parsers.d.ts.map