/**
 * @param {HTMLSelectElement} select
 * @return {string[]}
 */
export function getSelectValues(select: HTMLSelectElement): string[];
/**
 * Takes an HTML DOM and turns it into an XForm field.
 * @param {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} field - the field to convert
 * @return {Element}
 */
export function webForm2xForm(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): Element;
/**
 * @param {HTMLTextAreaElement} textarea
 */
export function placeCaretAtEnd(textarea: HTMLTextAreaElement): void;
/**
 * @param {string} s
 */
export function isMentionBoundary(s: string): boolean;
/**
 * Returns the current word being written in the input element
 * @method u#getCurrentWord
 * @param {HTMLInputElement|HTMLTextAreaElement} input - The HTMLElement in which text is being entered
 * @param {number} [index] - An optional rightmost boundary index. If given, the text
 *  value of the input element will only be considered up until this index.
 * @param {string|RegExp} [delineator] - An optional string delineator to
 *  differentiate between words.
 */
export function getCurrentWord(input: HTMLInputElement | HTMLTextAreaElement, index?: number, delineator?: string | RegExp): string;
/**
 * @param {HTMLInputElement} input - The HTMLElement in which text is being entered
 * @param {string} new_value
 */
export function replaceCurrentWord(input: HTMLInputElement, new_value: string): void;
/**
 * Validates a JID for user input scenarios where locked_domain or default_domain
 * may be configured. When these settings are present, users can enter just a username
 * without the domain part.
 * @param {string} jid - The JID to validate
 * @returns {boolean} True if the JID is valid or if a domain will be auto-appended
 */
export function isValidJIDInput(jid: string): boolean;
//# sourceMappingURL=form.d.ts.map