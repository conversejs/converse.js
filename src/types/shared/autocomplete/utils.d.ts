/**
 * Escapes special characters in a string to be used in a regular expression.
 * This function takes a string and returns a new string with all special characters
 * escaped, ensuring that the string can be safely used in a RegExp constructor.
 * @param {string} s - The string to escape.
 */
export function regExpEscape(s: string): string;
/**
 * @param {string} text
 * @param {string} input
 * @returns {boolean}
 */
export function FILTER_CONTAINS(text: string, input: string): boolean;
/**
 * @param {string} text
 * @param {string} input
 * @returns {boolean}
 */
export function FILTER_STARTSWITH(text: string, input: string): boolean;
/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function SORT_BY_LENGTH(a: string, b: string): number;
/**
 * Renders an item for display in a list.
 * @param {string} text - The text to display.
 * @param {string} input - The input string to highlight.
 * @returns {import('lit').TemplateResult} The rendered HTML for the item.
 */
export function getAutoCompleteItem(text: string, input: string): import("lit").TemplateResult;
export namespace helpers {
    function getElement(expr: any, el: any): any;
    function bind(element: any, o: any): void;
    function unbind(element: any, o: any): void;
    function isMention(word: any, ac_triggers: any): any;
}
export function SORT_BY_QUERY_POSITION(a: any, b: any): number;
//# sourceMappingURL=utils.d.ts.map