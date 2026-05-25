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
 * @param {import('./suggestion').default} a
 * @param {import('./suggestion').default} b
 * @returns {number}
 */
export function SORT_BY_LENGTH(a: import("./suggestion").default, b: import("./suggestion").default): number;
/**
 * Renders an item for display in a list.
 * @param {string} text - The text to display.
 * @param {string} input - The input string to highlight.
 * @returns {import('lit').TemplateResult} The rendered HTML for the item.
 */
export function getAutoCompleteItem(text: string, input: string): import("lit").TemplateResult;
export namespace helpers {
    /**
     * @param {string|HTMLElement} expr
     * @param {HTMLElement} [el]
     * @returns {HTMLElement|null}
     */
    function getElement(expr: string | HTMLElement, el?: HTMLElement): HTMLElement | null;
    /**
     * @param {HTMLElement} element
     * @param {Record<string, Function>} o
     */
    function bind(element: HTMLElement, o: Record<string, Function>): void;
    /**
     * @param {HTMLElement} element
     * @param {Record<string, Function>} o
     */
    function unbind(element: HTMLElement, o: Record<string, Function>): void;
    /**
     * @param {string} word
     * @param {string[]} ac_triggers
     * @returns {boolean}
     */
    function isMention(word: string, ac_triggers: string[]): boolean;
}
export function SORT_BY_QUERY_POSITION(a: import("./suggestion").default, b: import("./suggestion").default): number;
//# sourceMappingURL=utils.d.ts.map