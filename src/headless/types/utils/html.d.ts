/**
 * @param { any } el
 * @returns { boolean }
 */
export function isElement(el: any): boolean;
/**
 * @param { Element | typeof Strophe.Builder } stanza
 * @param { string } name
 * @returns { boolean }
 */
export function isTagEqual(stanza: Element | typeof Strophe.Builder, name: string): boolean;
/**
 * @param {HTMLElement} el
 * @param {boolean} include_margin
 */
export function getOuterWidth(el: HTMLElement, include_margin?: boolean): number;
/**
 * Converts an HTML string into a DOM element.
 * Expects that the HTML string has only one top-level element,
 * i.e. not multiple ones.
 * @method u#stringToElement
 * @param {string} s - The HTML string
 */
export function stringToElement(s: string): Element;
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
 * @param {string} str
 * @return {string}
 */
export function decodeHTMLEntities(str: string): string;
import { Strophe } from "strophe.js";
//# sourceMappingURL=html.d.ts.map