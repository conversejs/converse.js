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
 * @param {string} s
 */
export function isMentionBoundary(s: string): boolean;
/**
 * @param {HTMLInputElement} input - The HTMLElement in which text is being entered
 * @param {string} new_value
 */
export function replaceCurrentWord(input: HTMLInputElement, new_value: string): void;
/**
 * @param {HTMLTextAreaElement} textarea
 */
export function placeCaretAtEnd(textarea: HTMLTextAreaElement): void;
//# sourceMappingURL=form.d.ts.map