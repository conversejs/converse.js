/**
 * Extract the XEP-0359 stanza IDs from the passed in stanza
 * and return a map containing them.
 * @private
 * @param { Element } stanza - The message stanza
 * @returns { Object }
 */
export function getStanzaIDs(stanza: Element, original_stanza: any): any;
export function getEncryptionAttributes(stanza: any): {
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
    edited: any;
} | {
    replace_id?: undefined;
    edited?: undefined;
};
export function getOpenGraphMetadata(stanza: any): any;
export function getMediaURLsMetadata(text: any, offset?: number): {
    media_urls?: undefined;
} | {
    media_urls: {
        end: any;
        is_audio: any;
        is_image: any;
        is_video: any;
        is_encrypted: any;
        start: any;
    }[];
};
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
 * @param { Element } stana - The message stanza
 * @returns { Reference }
 */
export function getReferences(stanza: any): Reference;
export function getReceiptId(stanza: any): any;
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
 * @private
 * @method getChatMarker
 * @param { Element } stanza - The message stanza
 * @returns { Boolean }
 */
export function getChatMarker(stanza: Element): boolean;
export function isHeadline(stanza: any): boolean;
export function isServerMessage(stanza: any): boolean;
/**
 * Determines whether the passed in stanza is a XEP-0313 MAM stanza
 * @private
 * @method isArchived
 * @param { Element } stanza - The message stanza
 * @returns { Boolean }
 */
export function isArchived(original_stanza: any): boolean;
/**
 * Returns an object containing all attribute names and values for a particular element.
 * @method getAttributes
 * @param { Element } stanza
 * @returns { Object }
 */
export function getAttributes(stanza: Element): any;
export class StanzaParseError extends Error {
    constructor(message: any, stanza: any);
    stanza: any;
}
