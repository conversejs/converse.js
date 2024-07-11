/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the DOM/HTML utilities module.
 * @typedef {import('lit').TemplateResult} TemplateResult
 * @typedef {import('@converse/headless/types/shared/parsers').XFormField} XFormField
 */
import { render } from 'lit';
import { Builder, Stanza } from 'strophe.js';
import { api, converse, log, u } from '@converse/headless';
import tplAudio from 'templates/audio.js';
import tplFile from 'templates/file.js';
import tplDateInput from 'templates/form_date.js';
import tplFormCaptcha from '../templates/form_captcha.js';
import tplFormCheckbox from '../templates/form_checkbox.js';
import tplFormHelp from '../templates/form_help.js';
import tplFormInput from '../templates/form_input.js';
import tplFormSelect from '../templates/form_select.js';
import tplFormTextarea from '../templates/form_textarea.js';
import tplFormUrl from '../templates/form_url.js';
import tplFormUsername from '../templates/form_username.js';
import tplHyperlink from 'templates/hyperlink.js';
import tplVideo from 'templates/video.js';

const { sizzle, Strophe, dayjs } = converse.env;
const { getURI, isAudioURL, isImageURL, isVideoURL, isValidURL } = u;

const APPROVED_URL_PROTOCOLS = ['http', 'https', 'xmpp', 'mailto'];

const EMPTY_TEXT_REGEX = /\s*\n\s*/

/**
 * @param {Element|Builder|Stanza} el
 */
function stripEmptyTextNodes (el) {
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
    while (n = walker.nextNode()) text_nodes.push(n);
    text_nodes.forEach((n) => EMPTY_TEXT_REGEX.test(/** @type {Text} */(n).data) && n.parentElement.removeChild(n))

    return el;
}

/**
 * @param {string} name
 * @param {{ new_password: string }} options
 */
function getAutoCompleteProperty (name, options) {
    return {
        'muc#roomconfig_lang': 'language',
        'muc#roomconfig_roomsecret': options?.new_password ? 'new-password' : 'current-password'
    }[name];
}

const serializer = new XMLSerializer();

/**
 * Given two XML or HTML elements, determine if they're equal
 * @param {Element} actual
 * @param {Element} expected
 * @returns {Boolean}
 */
function isEqualNode (actual, expected) {
    if (!u.isElement(actual)) throw new Error('Element being compared must be an Element!');

    actual = stripEmptyTextNodes(actual);
    expected = stripEmptyTextNodes(expected);

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
        const actual_string = serializer.serializeToString(actual);
        const expected_string = serializer.serializeToString(expected);
        isEqual =
            actual_string === expected_string || xmlHtmlNode(actual_string).isEqualNode(xmlHtmlNode(expected_string));
    }

    return isEqual;
}

/**
 * Given an HTMLElement representing a form field, return it's name and value.
 * @param {HTMLInputElement|HTMLSelectElement} field
 * @returns {{[key:string]:string|number|string[]}|null}
 */
export function getNameAndValue(field) {
    const name = field.getAttribute('name');
    if (!name) {
        return null; // See #1924
    }
    let value;
    if (field.getAttribute('type') === 'checkbox') {
        value = /** @type {HTMLInputElement} */(field).checked && 1 || 0;
    } else if (field.tagName == "TEXTAREA") {
        value = field.value.split('\n').filter(s => s.trim());
    } else if (field.tagName == "SELECT") {
        value = u.getSelectValues(/** @type {HTMLSelectElement} */(field));
    } else {
        value = field.value;
    }
    return { name, value };
}

/**
 * @param {HTMLElement} el
 */
function slideOutWrapup (el) {
    /* Wrapup function for slideOut. */
    el.removeAttribute('data-slider-marker');
    el.classList.remove('collapsed');
    el.style.overflow = '';
    el.style.height = '';
}

export function getFileName (url) {
    const uri = getURI(url);
    try {
        return decodeURI(uri.filename());
    } catch (error) {
        log.debug(error);
        return uri.filename();
    }
}

/**
 * Returns the markup for a URL that points to a downloadable asset
 * (such as a video, image or audio file).
 * @method u#getOOBURLMarkup
 * @param {string} url
 * @returns {TemplateResult|string}
 */
export function getOOBURLMarkup (url) {
    const uri = getURI(url);
    if (uri === null) {
        return url;
    }
    if (isVideoURL(uri)) {
        return tplVideo(url);
    } else if (isAudioURL(uri)) {
        return tplAudio(url);
    } else if (isImageURL(uri)) {
        return tplFile(uri.toString(), getFileName(uri));
    } else {
        return tplFile(uri.toString(), getFileName(uri));
    }
}

/**
 * Return the height of the passed in DOM element,
 * based on the heights of its children.
 * @method u#calculateElementHeight
 * @param {HTMLElement} el
 * @returns {number}
 */
function calculateElementHeight (el) {
    return Array.from(el.children).reduce((result, child) => {
        if (child instanceof HTMLElement) {
            return result + child.offsetHeight;
        }
        return result;
    }, 0);
}

function getNextElement (el, selector = '*') {
    let next_el = el.nextElementSibling;
    while (next_el !== null && !sizzle.matchesSelector(next_el, selector)) {
        next_el = next_el.nextElementSibling;
    }
    return next_el;
}

/**
 * Has an element a class?
 * @method u#hasClass
 * @param { string } className
 * @param { Element } el
 */
export function hasClass (className, el) {
    return el instanceof Element && el.classList.contains(className);
}

/**
 * Add a class to an element.
 * @method u#addClass
 * @param { string } className
 * @param { Element } el
 */
export function addClass (className, el) {
    el instanceof Element && el.classList.add(className);
    return el;
}

/**
 * Remove a class from an element.
 * @method u#removeClass
 * @param { string } className
 * @param { Element } el
 */
export function removeClass (className, el) {
    el instanceof Element && el.classList.remove(className);
    return el;
}

/**
 * Remove an element from its parent
 * @method u#removeElement
 * @param { Element } el
 */
export function removeElement (el) {
    el instanceof Element && el.parentNode && el.parentNode.removeChild(el);
    return el;
}

/**
 * @param {TemplateResult} tr
 */
function getElementFromTemplateResult (tr) {
    const div = document.createElement('div');
    render(tr, div);
    return div.firstElementChild;
}

/**
 * @param {Element} el
 */
function showElement (el) {
    removeClass('collapsed', el);
    removeClass('hidden', el);
}

/**
 * @param {Element} el
 */
function hideElement (el) {
    el instanceof Element && el.classList.add('hidden');
    return el;
}

/**
 * @param {HTMLElement} el
 * @param {String} selector
 */
export function ancestor (el, selector) {
    let parent = el;
    while (parent !== null && !sizzle.matchesSelector(parent, selector)) {
        parent = parent.parentElement;
    }
    return parent;
}

/**
 * Return the element's siblings until one matches the selector.
 * @method u#nextUntil
 * @param {HTMLElement} el
 * @param {String} selector
 */
function nextUntil (el, selector) {
    const matches = [];
    let sibling_el = el.nextElementSibling;
    while (sibling_el !== null && !sibling_el.matches(selector)) {
        matches.push(sibling_el);
        sibling_el = sibling_el.nextElementSibling;
    }
    return matches;
}

/**
 * Helper method that replace HTML-escaped symbols with equivalent characters
 * (e.g. transform occurrences of '&amp;' to '&')
 * @method u#unescapeHTML
 * @param { String } string - a String containing the HTML-escaped symbols.
 */
function unescapeHTML (string) {
    var div = document.createElement('div');
    div.innerHTML = string;
    return div.innerText;
}

/**
 * @method u#escapeHTML
 * @param {string} string
 */
function escapeHTML (string) {
    return string
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function isProtocolApproved (protocol, safeProtocolsList = APPROVED_URL_PROTOCOLS) {
    return !!safeProtocolsList.includes(protocol);
}

/**
 * @param {string} url
 */
export function getHyperlinkTemplate (url) {
    const http_url = RegExp('^w{3}.', 'ig').test(url) ? `http://${url}` : url;
    const uri = getURI(url);
    if (uri !== null && isValidURL(http_url) && (isProtocolApproved(uri._parts.protocol) || !uri._parts.protocol)) {
        return tplHyperlink(uri, url);
    }
    return url;
}

/**
 * Shows/expands an element by sliding it out of itself
 * @method slideOut
 * @param {HTMLElement} el - The HTML string
 * @param {Number} duration - The duration amount in milliseconds
 */
export function slideOut (el, duration = 200) {
    return new Promise((resolve, reject) => {
        if (!el) {
            const err = 'An element needs to be passed in to slideOut';
            log.warn(err);
            reject(new Error(err));
            return;
        }
        const marker = el.getAttribute('data-slider-marker');
        if (marker && !Number.isNaN(Number(marker))) {
            el.removeAttribute('data-slider-marker');
            cancelAnimationFrame(Number(marker));
        }
        const end_height = calculateElementHeight(el);
        if (api.settings.get('disable_effects')) {
            // Effects are disabled (for tests)
            el.style.height = end_height + 'px';
            slideOutWrapup(el);
            resolve();
            return;
        }
        if (!hasClass('collapsed', el) && !hasClass('hidden', el)) {
            resolve();
            return;
        }

        const steps = duration / 17; // We assume 17ms per animation which is ~60FPS
        let height = 0;

        function draw () {
            height += end_height / steps;
            if (height < end_height) {
                el.style.height = height + 'px';
                el.setAttribute('data-slider-marker', requestAnimationFrame(draw).toString());
            } else {
                // We recalculate the height to work around an apparent
                // browser bug where browsers don't know the correct
                // offsetHeight beforehand.
                el.removeAttribute('data-slider-marker');
                el.style.height = calculateElementHeight(el) + 'px';
                el.style.overflow = '';
                el.style.height = '';
                resolve();
            }
        }
        el.style.height = '0';
        el.style.overflow = 'hidden';
        el.classList.remove('hidden');
        el.classList.remove('collapsed');
        el.setAttribute('data-slider-marker', requestAnimationFrame(draw).toString());
    });
}

/**
 * Hides/contracts an element by sliding it into itself
 * @param {HTMLElement} el - The HTML string
 * @param {Number} duration - The duration amount in milliseconds
 */
export function slideIn (el, duration = 200) {
    return new Promise((resolve, reject) => {
        if (!el) {
            const err = 'An element needs to be passed in to slideIn';
            log.warn(err);
            return reject(new Error(err));
        } else if (hasClass('collapsed', el)) {
            return resolve(el);
        } else if (api.settings.get('disable_effects')) {
            // Effects are disabled (for tests)
            el.classList.add('collapsed');
            el.style.height = '';
            return resolve(el);
        }
        const marker = el.getAttribute('data-slider-marker');
        if (marker && !Number.isNaN(Number(marker))) {
            el.removeAttribute('data-slider-marker');
            cancelAnimationFrame(Number(marker));
        }
        const original_height = el.offsetHeight,
            steps = duration / 17; // We assume 17ms per animation which is ~60FPS
        let height = original_height;

        el.style.overflow = 'hidden';

        function draw () {
            height -= original_height / steps;
            if (height > 0) {
                el.style.height = height + 'px';
                el.setAttribute('data-slider-marker', requestAnimationFrame(draw).toString());
            } else {
                el.removeAttribute('data-slider-marker');
                el.classList.add('collapsed');
                el.style.height = '';
                resolve(el);
            }
        }
        el.setAttribute('data-slider-marker', requestAnimationFrame(draw).toString());
    });
}

/**
 * @param {HTMLElement} el
 */
function isInDOM (el) {
    return document.querySelector('body').contains(el);
}

/**
 * @param {HTMLElement} el
 */
function isVisible (el) {
    if (el === null) {
        return false;
    }
    if (hasClass('hidden', el)) {
        return false;
    }
    // XXX: Taken from jQuery's "visible" implementation
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

/**
 * Takes an XML field in XMPP XForm (XEP-004: Data Forms) format returns a
 * [TemplateResult](https://lit.polymer-project.org/api/classes/_lit_html_.templateresult.html).
 * @param {XFormField} xfield - the field to convert
 * @param {Object} options
 * @returns {TemplateResult}
 */
export function xFormField2TemplateResult(xfield, options = {}) {
    const default_vals = {
        id: u.getUniqueId(),
        name: xfield.var,
    };

    if (xfield['type'] === 'list-single' || xfield['type'] === 'list-multi') {
        return tplFormSelect({
            ...default_vals,
            ...xfield,
            multiple: xfield.type === 'list-multi',
        });

    } else if (xfield['type'] === 'fixed') {
        return tplFormHelp(xfield);

    } else if (xfield['type'] === 'jid-multi') {
        return tplFormTextarea({ ...default_vals, ...xfield });

    } else if (xfield['type'] === 'boolean') {
        return tplFormCheckbox({ ...default_vals, ...xfield });

    } else if (xfield.var === 'username') {
        return tplFormUsername({
            ...default_vals,
            domain: options.domain ? ' @' + options.domain : '',
            ...xfield,
        });
    } else if (xfield.var === 'password') {
        return tplFormInput({
            ...default_vals,
            ...xfield,
            autocomplete: getAutoCompleteProperty(xfield.var, options),
            fixed_username: options?.fixed_username,
            type: 'password',
        });
    } else if (xfield.var === 'ocr') {
        return tplFormCaptcha({
            ...default_vals,
            ...xfield,
            data: xfield.uri.data,
            type: xfield.uri.type,
        });
    } else if (xfield.type !== 'hidden' && (xfield.var === 'url' || xfield.var === 'uri' || isValidURL(xfield.value))) {
        return tplFormUrl(xfield);
    } else if (xfield.type === 'datetime' || xfield.type === 'date') {
        const date = xfield.value ? dayjs(xfield.value) : null;
        const value = date?.isValid()
            ? (xfield.type === 'datetime' ? date.format('YYYY-MM-DDTHH:mm:ss') : date.format('YYYY-MM-DD'))
            : null;
        return tplDateInput({
            ...default_vals,
            ...xfield,
            value
        });
    } else {

        return tplFormInput({
            ...default_vals,
            ...xfield,
            autocomplete: getAutoCompleteProperty(xfield.var, options),
            placeholder: null,
        });
    }
}

/**
 * @param {HTMLElement} el
 * @param {boolean} include_margin
 */
export function getOuterWidth (el, include_margin=false) {
    let width = el.offsetWidth;
    if (!include_margin) {
        return width;
    }
    const style = window.getComputedStyle(el);
    width += parseInt(style.marginLeft ? style.marginLeft : '0', 10) +
             parseInt(style.marginRight ? style.marginRight : '0', 10);
    return width;
}

Object.assign(u, {
    addClass,
    ancestor,
    calculateElementHeight,
    escapeHTML,
    getElementFromTemplateResult,
    getNextElement,
    getOOBURLMarkup,
    getOuterWidth,
    hasClass,
    hideElement,
    isEqualNode,
    isInDOM,
    isVisible,
    nextUntil,
    removeClass,
    removeElement,
    showElement,
    slideIn,
    slideOut,
    unescapeHTML,
    xFormField2TemplateResult,
});

export default u;
