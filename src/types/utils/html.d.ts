/**
 * Given an HTMLElement representing a form field, return it's name and value.
 * @param {HTMLInputElement|HTMLSelectElement} field
 * @returns {{[key:string]:string|number|string[]}|null}
 */
export function getNameAndValue(field: HTMLInputElement | HTMLSelectElement): {
    [key: string]: string | number | string[];
};
export function getFileName(url: any): any;
/**
 * Returns the markup for a URL that points to a downloadable asset
 * (such as a video, image or audio file).
 * @method u#getOOBURLMarkup
 * @param {string} url
 * @returns {TemplateResult|string}
 */
export function getOOBURLMarkup(url: string): TemplateResult | string;
/**
 * Has an element a class?
 * @method u#hasClass
 * @param { string } className
 * @param { Element } el
 */
export function hasClass(className: string, el: Element): boolean;
/**
 * Add a class to an element.
 * @method u#addClass
 * @param { string } className
 * @param { Element } el
 */
export function addClass(className: string, el: Element): Element;
/**
 * Remove a class from an element.
 * @method u#removeClass
 * @param { string } className
 * @param { Element } el
 */
export function removeClass(className: string, el: Element): Element;
/**
 * Remove an element from its parent
 * @method u#removeElement
 * @param { Element } el
 */
export function removeElement(el: Element): Element;
export function ancestor(el: any, selector: any): any;
/**
 * @param {string} url
 */
export function getHyperlinkTemplate(url: string): string | import("lit-html").TemplateResult<1>;
/**
 * Shows/expands an element by sliding it out of itself
 * @method slideOut
 * @param { HTMLElement } el - The HTML string
 * @param { Number } duration - The duration amount in milliseconds
 */
export function slideOut(el: HTMLElement, duration?: number): Promise<any>;
/**
 * Hides/contracts an element by sliding it into itself
 * @param {HTMLElement} el - The HTML string
 * @param {Number} duration - The duration amount in milliseconds
 */
export function slideIn(el: HTMLElement, duration?: number): Promise<any>;
/**
 * Takes an XML field in XMPP XForm (XEP-004: Data Forms) format returns a
 * [TemplateResult](https://lit.polymer-project.org/api/classes/_lit_html_.templateresult.html).
 * @method u#xForm2TemplateResult
 * @param {HTMLElement} field - the field to convert
 * @param {Element} stanza - the containing stanza
 * @param {Object} options
 * @returns {TemplateResult}
 */
export function xForm2TemplateResult(field: HTMLElement, stanza: Element, options?: any): TemplateResult;
export default u;
export type TemplateResult = import('lit').TemplateResult;
export namespace Strophe {
    type Builder = any;
}
import u from "../headless/utils/index.js";
//# sourceMappingURL=html.d.ts.map