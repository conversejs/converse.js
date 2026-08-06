/**
 * @param {unknown} el
 * @returns {boolean}
 */
export function isElement(el: unknown): boolean;
/**
 * Given two XML or HTML elements, determine if they're equal
 * @param {Element} actual
 * @param {Element} expected
 * @returns {Boolean}
 */
export function isEqualNode(actual: Element, expected: Element): boolean;
/**
 * @param {Element | typeof Strophe.Builder} stanza
 * @param {string} name
 * @returns {boolean}
 */
export function isTagEqual(stanza: Element | typeof Strophe.Builder, name: string): boolean;
/**
 * Returns a list of children of the DOM element that match the selector.
 * @method u#queryChildren
 * @param {HTMLElement} el - the DOM element
 * @param {string} selector - the selector they should be matched against
 */
export function queryChildren(el: HTMLElement, selector: string): ChildNode[];
/**
 * @param {Element} el - the DOM element
 * @return {number}
 */
export function siblingIndex(el: Element): number;
/**
 * Strips tags and decodes HTML entities in `str`, returning plain text.
 * Isomorphic: no DOM is involved, so this works under Node too.
 * @param {string} str
 * @return {string}
 */
export function decodeHTMLEntities(str: string): string;
/**
 * Helper method that replace HTML-escaped symbols with equivalent characters
 * (e.g. transform occurrences of '&amp;' to '&')
 * @param {string} string - a String containing the HTML-escaped symbols.
 * @return {string}
 */
export function unescapeHTML(string: string): string;
import { Strophe } from 'strophe.js';
//# sourceMappingURL=html.d.ts.map