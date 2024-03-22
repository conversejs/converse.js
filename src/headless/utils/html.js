import DOMPurify from 'dompurify';
import { Strophe } from 'strophe.js';

/**
 * @param { any } el
 * @returns { boolean }
 */
export function isElement (el) {
    return el instanceof Element || el instanceof HTMLDocument;
}

/**
 * @param { Element | typeof Strophe.Builder } stanza
 * @param { string } name
 * @returns { boolean }
 */
export function isTagEqual (stanza, name) {
    if (stanza instanceof Strophe.Builder) {
        return isTagEqual(stanza.tree(), name);
    } else if (!(stanza instanceof Element)) {
        throw Error(
            "isTagEqual called with value which isn't "+
            "an element or Strophe.Builder instance");
    } else {
        return Strophe.isTagEqual(stanza, name);
    }
}

/**
 * Converts an HTML string into a DOM element.
 * Expects that the HTML string has only one top-level element,
 * i.e. not multiple ones.
 * @method u#stringToElement
 * @param {string} s - The HTML string
 */
export function stringToElement (s) {
    var div = document.createElement('div');
    div.innerHTML = s;
    return div.firstElementChild;
}

/**
 * Returns a list of children of the DOM element that match the selector.
 * @method u#queryChildren
 * @param {HTMLElement} el - the DOM element
 * @param {string} selector - the selector they should be matched against
 */
export function queryChildren (el, selector) {
    return Array.from(el.childNodes).filter(el => (el instanceof Element) && el.matches(selector));
}

/**
 * @param {Element} el - the DOM element
 * @return {number}
 */
export function siblingIndex (el) {
    /* eslint-disable no-cond-assign */
    for (var i = 0; el = el.previousElementSibling; i++);
    return i;
}

const element = document.createElement('div');

/**
 * @param {string} str
 * @return {string}
 */
export function decodeHTMLEntities (str) {
    if (str && typeof str === 'string') {
        element.innerHTML = DOMPurify.sanitize(str);
        str = element.textContent;
        element.textContent = '';
    }
    return str;
}
