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
    encryption_namespace: string;
};
/**
 * @param {Element} stanza - The message stanza
 * @param {Element} original_stanza - The original stanza, that contains the
 *  message stanza, if it was contained, otherwise it's the message stanza itself.
 * @returns {Object}
 */
export function getRetractionAttributes(stanza: Element, original_stanza: Element): any;
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
} | {
    is_error?: undefined;
    error_text?: undefined;
    error_type?: undefined;
    error_condition?: undefined;
};
/**
 * @typedef {Object} Reference
 * An object representing XEP-0372 reference data
 * @property {number} begin
 * @property {number} end
 * @property {string} type
 * @property {String} value
 * @property {String} uri
 */
/**
 * Given a message stanza, find and return any XEP-0372 references
 * @param {Element} stanza - The message stanza
 * @returns {Reference[]}
 */
export function getReferences(stanza: Element): Reference[];
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
/**
 * @param {Element} field
 */
export function getInputType(field: Element): any;
/**
* @param {Element} stanza
* @returns {XForm}
*/
export function parseXForm(stanza: Element): XForm;
export class StanzaParseError extends Error {
    /**
     * @param {string} message
     * @param {Element} stanza
     */
    constructor(message: string, stanza: Element);
    stanza: Element;
}
/**
 * An object representing XEP-0372 reference data
 */
export type Reference = {
    begin: number;
    end: number;
    type: string;
    value: string;
    uri: string;
};
export type XFormReportedField = {
    var: string;
    label: string;
};
export type XFormResultItemField = {
    var: string;
    value: string;
};
export type XFormOption = {
    value: string;
    label: string;
    selected: boolean;
    required: boolean;
};
export type XFormCaptchaURI = {
    type: string;
    data: string;
};
export type XFormListTypes = "list-single" | "list-multi";
export type XFormJIDTypes = "jid-single" | "jid-multi";
export type XFormTextTypes = "text-multi" | "text-private" | "text-single";
export type XFormDateTypes = "date" | "datetime";
export type XFormFieldTypes = XFormListTypes | XFormJIDTypes | XFormTextTypes | XFormDateTypes | "fixed" | "boolean" | "url" | "hidden";
export type XFormField = {
    var: string;
    label: string;
    type?: XFormFieldTypes;
    text?: string;
    value?: string;
    required?: boolean;
    checked?: boolean;
    options?: XFormOption[];
    uri?: XFormCaptchaURI;
    readonly: boolean;
};
export type XFormResponseType = "result" | "form";
export type XForm = {
    type: XFormResponseType;
    title?: string;
    instructions?: string;
    reported?: XFormReportedField[];
    items?: XFormResultItemField[][];
    fields?: XFormField[];
};
//# sourceMappingURL=parsers.d.ts.map