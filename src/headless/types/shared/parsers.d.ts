/**
 * @param {Element|Error|null} stanza - The stanza to be parsed. As a convenience,
 * an Error element can be passed in as well, so that this function can be
 * called in a catch block without first checking if a stanza or Error
 * element was received.
 * @returns {Promise<Error|errors.StanzaError|null>}
 */
export function parseErrorStanza(stanza: Element | Error | null): Promise<Error | errors.StanzaError | null>;
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
 * @returns {import('./types').EncryptionAttrs}
 */
export function getEncryptionAttributes(stanza: Element): import("./types").EncryptionAttrs;
/**
 * @param {Element} stanza - The message stanza
 * @param {Element} original_stanza - The original stanza, that contains the
 *  message stanza, if it was contained, otherwise it's the message stanza itself.
 * @returns {import('./types').RetractionAttrs | {}}
 */
export function getDeprecatedRetractionAttributes(stanza: Element, original_stanza: Element): import("./types").RetractionAttrs | {};
/**
 * @param {Element} stanza - The message stanza
 * @param {Element} original_stanza - The original stanza, that contains the
 *  message stanza, if it was contained, otherwise it's the message stanza itself.
 * @returns {import('./types').RetractionAttrs | {}}
 */
export function getRetractionAttributes(stanza: Element, original_stanza: Element): import("./types").RetractionAttrs | {};
/**
 * @param {Element} stanza
 * @param {Element} original_stanza
 */
export function getCorrectionAttributes(stanza: Element, original_stanza: Element): {
    replace_id: string;
    edited: string;
} | {
    replace_id?: undefined;
    edited?: undefined;
};
/**
 * @param {Element} stanza
 */
export function getOpenGraphMetadata(stanza: Element): {};
/**
 * @param {Element} stanza
 */
export function getSpoilerAttributes(stanza: Element): {
    is_spoiler: boolean;
    spoiler_hint: string;
};
/**
 * @param {Element} stanza
 */
export function getOutOfBandAttributes(stanza: Element): {
    oob_url: string;
    oob_desc: string;
} | {
    oob_url?: undefined;
    oob_desc?: undefined;
};
/**
 * Returns the human readable error message contained in a `groupchat` message stanza of type `error`.
 * @param {Element} stanza - The message stanza
 */
export function getErrorAttributes(stanza: Element): {
    is_error: boolean;
    error_text: string;
    error_type: string;
    error_condition: string;
    errors: {
        name: string;
        xmlns: string;
    }[];
} | {
    is_error?: undefined;
    error_text?: undefined;
    error_type?: undefined;
    error_condition?: undefined;
    errors?: undefined;
};
/**
 * Given a message stanza, find and return any XEP-0372 references
 * @param {Element} stanza - The message stanza
 * @returns {import('./types').XEP372Reference[]}
 */
export function getReferences(stanza: Element): import("./types").XEP372Reference[];
/**
 * @param {Element} stanza
 */
export function getReceiptId(stanza: Element): string;
/**
 * Determines whether the passed in stanza is a XEP-0280 Carbon
 * @param {Element} stanza - The message stanza
 * @returns {Boolean}
 */
export function isCarbon(stanza: Element): boolean;
/**
 * Returns the XEP-0085 chat state contained in a message stanza
 * @param {Element} stanza - The message stanza
 */
export function getChatState(stanza: Element): string;
/**
 * @param {Element} stanza
 * @param {Object} attrs
 */
export function isValidReceiptRequest(stanza: Element, attrs: any): number;
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
 * @returns {boolean}
 */
export function isHeadline(stanza: Element): boolean;
/**
 * @param {Element} stanza
 * @returns {Promise<boolean>}
 */
export function isMUCPrivateMessage(stanza: Element): Promise<boolean>;
/**
 * @param {Element} stanza
 * @returns {boolean}
 */
export function isServerMessage(stanza: Element): boolean;
/**
 * Determines whether the passed in stanza is a XEP-0313 MAM stanza
 * @method isArchived
 * @param {Element} original_stanza - The message stanza
 * @returns {boolean}
 */
export function isArchived(original_stanza: Element): boolean;
/**
 * @param {Element} field
 */
export function getInputType(field: Element): any;
/**
 * @param {Element} stanza
 * @returns {import('./types').XForm}
 */
export function parseXForm(stanza: Element): import("./types").XForm;
import * as errors from './errors.js';
//# sourceMappingURL=parsers.d.ts.map