import he from 'he';
import { Strophe, Builder, Stanza } from 'strophe.js';

/**
 * @param {unknown} el
 * @returns {boolean}
 */
export function isElement(el) {
    // Checked by nodeType rather than `instanceof`, because `HTMLDocument`
    // doesn't exist outside a browser and because stanzas built in another
    // realm (a shared worker, an iframe) fail an `instanceof` check.
    const node_type = /** @type {Node} */ (el)?.nodeType;
    return node_type === 1 /* ELEMENT_NODE */ || node_type === 9; /* DOCUMENT_NODE */
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
    if (!isElement(actual)) {
        if (actual instanceof Strophe.Builder) {
            actual = actual.tree();
        } else {
            throw new Error('Element being compared must be an Element!');
        }
    }

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

// A `<` only opens markup when a tag name, an end tag, a comment or a
// declaration follows it. A `<` followed by anything else (`3 < 5`) is text.
const MARKUP_START = /[a-zA-Z!/?]/;

// The name of a start tag, which runs up to the first whitespace, `/` or `>`.
// An end tag is deliberately not matched: only a start tag opens an element.
const TAG_NAME = /^([a-zA-Z][^\s/>]*)/;

// Elements whose content is raw text rather than markup. They're dropped along
// with their content, as the sanitizer this replaced did, because that content
// was never meant to be read as text. A Map rather than an object, so that a
// tag named after something on `Object.prototype` doesn't look like a match.
const RAW_TEXT_END = new Map([
    ['script', /<\/script/i],
    ['style', /<\/style/i],
]);

/**
 * Returns the index just past the markup construct that starts at `start`,
 * where `html[start]` is the opening `<`.
 *
 * A construct that's never closed swallows the rest of the input, which is what
 * an HTML parser does with a tag still open at the end of a document. That's
 * what keeps a truncated `<script src="x` from surviving into the output, and
 * it's the case a `/<[^>]*>/g` style regex misses.
 * @param {string} html
 * @param {number} start
 * @returns {number}
 */
function endOfMarkup(html, start) {
    if (html.startsWith('<!--', start)) {
        const end = html.indexOf('-->', start + 4);
        return end === -1 ? html.length : end + 3;
    }
    // Scan for the `>` that closes the tag, skipping any inside a quoted
    // attribute value. Quotes count wherever they appear rather than only after
    // an `=`, which can consume a little more than an HTML parser would; that
    // can only ever remove more markup, never leave some behind.
    let quote = '';
    for (let i = start + 1; i < html.length; i++) {
        const c = html[i];
        if (quote) {
            if (c === quote) quote = '';
        } else if (c === '"' || c === "'") {
            quote = c;
        } else if (c === '>') {
            return i + 1;
        }
    }
    return html.length;
}

/**
 * Converts an HTML fragment to the plain text a browser's `textContent` would
 * yield for it, without needing a DOM.
 *
 * The markup is scanned rather than matched with a regular expression, because
 * a tag-shaped regex needs the closing `>` and so leaves an unterminated tag
 * behind. Entities are decoded per text run, once the tags are gone, so that an
 * entity-encoded tag (`&lt;b&gt;`) survives as text, and so that a decoded one
 * can't combine with the text beside it into something tag-shaped.
 * @param {string} html
 * @returns {string}
 */
function htmlToText(html) {
    let text = '';
    let i = 0;
    while (i < html.length) {
        const lt = html.indexOf('<', i);
        if (lt === -1) break;

        if (!MARKUP_START.test(html[lt + 1] ?? '')) {
            // A bare `<`. Keep it as text and carry on after it.
            text += he.decode(html.slice(i, lt + 1));
            i = lt + 1;
            continue;
        }

        text += he.decode(html.slice(i, lt));
        i = endOfMarkup(html, lt);

        const tag = TAG_NAME.exec(html.slice(lt + 1, i))?.[1].toLowerCase();
        const end_tag = RAW_TEXT_END.get(tag);
        if (end_tag) {
            const offset = html.slice(i).search(end_tag);
            i = offset === -1 ? html.length : endOfMarkup(html, i + offset);
        }
    }
    return text + he.decode(html.slice(i));
}

/**
 * Strips tags and decodes HTML entities in `str`, returning plain text.
 * Isomorphic: no DOM is involved, so this works under Node too.
 * @param {string} str
 * @return {string}
 */
export function decodeHTMLEntities(str) {
    if (str && typeof str === 'string') {
        return htmlToText(str);
    }
    return str;
}

/**
 * Helper method that replace HTML-escaped symbols with equivalent characters
 * (e.g. transform occurrences of '&amp;' to '&')
 * @param {string} string - a String containing the HTML-escaped symbols.
 * @return {string}
 */
export function unescapeHTML(string) {
    return typeof string === 'string' ? he.decode(string) : string;
}
