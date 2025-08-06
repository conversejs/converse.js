import DOMPurify from 'dompurify';
import { Strophe, Builder, Stanza } from 'strophe.js';

/**
 * @param {unknown} el
 * @returns {boolean}
 */
export function isElement(el) {
    return el instanceof Element || el instanceof HTMLDocument;
}

const EMPTY_TEXT_REGEX = /\s*\n\s*/;

/**
 * @param {Element|Builder|Stanza} el
 */
function stripEmptyTextNodes(el) {
    if (el instanceof Builder || el instanceof Stanza) {
        el = el.tree();
    }

    let n;
    const text_nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, (node) => {
        if (node.parentElement.nodeName.toLowerCase() === 'body') {
            return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
    });
    while ((n = walker.nextNode())) text_nodes.push(n);
    text_nodes.forEach((n) => EMPTY_TEXT_REGEX.test(/** @type {Text} */ (n).data) && n.parentElement.removeChild(n));

    return el;
}

/**
 * Given two XML or HTML elements, determine if they're equal
 * @param {Element} actual
 * @param {Element} expected
 * @returns {Boolean}
 */
export function isEqualNode(actual, expected) {
    if (!isElement(actual)) throw new Error('Element being compared must be an Element!');

    expected = stripEmptyTextNodes(expected);
    actual = stripEmptyTextNodes(actual);

    let isEqual = actual.isEqualNode(expected);

    if (!isEqual) {
        // XXX: This is a hack.
        // When creating two XML elements, one via DOMParser, and one via
        // createElementNS (or createElement), then "isEqualNode" doesn't match.
        //
        // For example, in the following code `isEqual` is false:
        // ------------------------------------------------------
        // const a = document.createElementNS('foo', 'div');
        // a.setAttribute('xmlns', 'foo');
        //
        // const b = (new DOMParser()).parseFromString('<div xmlns="foo"></div>', 'text/xml').firstElementChild;
        // const isEqual = a.isEqualNode(div); //  false
        //
        // The workaround here is to serialize both elements to string and then use
        // DOMParser again for both (via xmlHtmlNode).
        //
        // This is not efficient, but currently this is only being used in tests.
        //
        const { xmlHtmlNode } = Strophe;
        const actual_string = Strophe.serialize(actual);
        const expected_string = Strophe.serialize(expected);
        isEqual =
            actual_string === expected_string || xmlHtmlNode(actual_string).isEqualNode(xmlHtmlNode(expected_string));
    }
    return isEqual;
}

/**
 * @param {Element | typeof Strophe.Builder} stanza
 * @param {string} name
 * @returns {boolean}
 */
export function isTagEqual(stanza, name) {
    if (stanza instanceof Strophe.Builder) {
        return isTagEqual(stanza.tree(), name);
    } else if (!(stanza instanceof Element)) {
        throw Error("isTagEqual called with value which isn't " + 'an element or Strophe.Builder instance');
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
export function stringToElement(s) {
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
export function queryChildren(el, selector) {
    return Array.from(el.childNodes).filter((el) => el instanceof Element && el.matches(selector));
}

/**
 * @param {Element} el - the DOM element
 * @return {number}
 */
export function siblingIndex(el) {
    /* eslint-disable no-cond-assign */
    for (var i = 0; (el = el.previousElementSibling); i++);
    return i;
}

const element = document.createElement('div');

/**
 * @param {string} str
 * @return {string}
 */
export function decodeHTMLEntities(str) {
    if (str && typeof str === 'string') {
        element.innerHTML = DOMPurify.sanitize(str);
        str = element.textContent;
        element.textContent = '';
    }
    return str;
}
