/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the DOM/HTML utilities module.
 */
import isFunction from 'lodash-es/isFunction';
import log from '@converse/headless/log';
import tplAudio from 'templates/audio.js';
import tplFile from 'templates/file.js';
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
import u from '../headless/utils/core';
import { converse } from '@converse/headless/core';
import { getURI, isAudioURL, isImageURL, isVideoURL } from '@converse/headless/utils/url.js';
import { render } from 'lit';

const { sizzle, Strophe } = converse.env;

const APPROVED_URL_PROTOCOLS = ['http', 'https', 'xmpp', 'mailto'];

function getAutoCompleteProperty (name, options) {
    return {
        'muc#roomconfig_lang': 'language',
        'muc#roomconfig_roomsecret': options?.new_password ? 'new-password' : 'current-password'
    }[name];
}

const XFORM_TYPE_MAP = {
    'text-private': 'password',
    'text-single': 'text',
    'fixed': 'label',
    'boolean': 'checkbox',
    'hidden': 'hidden',
    'jid-multi': 'textarea',
    'list-single': 'dropdown',
    'list-multi': 'dropdown'
};

const XFORM_VALIDATE_TYPE_MAP = {
    'xs:anyURI': 'url',
    'xs:byte': 'number',
    'xs:date': 'date',
    'xs:dateTime': 'datetime',
    'xs:int': 'number',
    'xs:integer': 'number',
    'xs:time': 'time',
}


const EMPTY_TEXT_REGEX = /\s*\n\s*/

function stripEmptyTextNodes (el) {
    el = el.tree?.() ?? el;

    let n;
    const text_nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, (node) => {
        if (node.parentElement.nodeName.toLowerCase() === 'body') {
            return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
    });
    while (n = walker.nextNode()) text_nodes.push(n);
    text_nodes.forEach((n) => EMPTY_TEXT_REGEX.test(n.data) && n.parentElement.removeChild(n))

    return el;
}

const serializer = new XMLSerializer();

/**
 * Given two XML or HTML elements, determine if they're equal
 * @param { XMLElement | HTMLElement } actual
 * @param { XMLElement | HTMLElement } expected
 * @returns { Boolean }
 */
function isEqualNode (actual, expected) {
    if (!u.isElement(actual)) throw new Error("Element being compared must be an Element!");

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
        isEqual = actual_string === expected_string || xmlHtmlNode(actual_string).isEqualNode(xmlHtmlNode(expected_string));
    }

    return isEqual;
}

/**
 * Given an HTMLElement representing a form field, return it's name and value.
 * @param { HTMLElement } field
 * @returns { { string, string } | null }
 */
export function getNameAndValue(field) {
    const name = field.getAttribute('name');
    if (!name) {
        return null; // See #1924
    }
    let value;
    if (field.getAttribute('type') === 'checkbox') {
        value = field.checked && 1 || 0;
    } else if (field.tagName == "TEXTAREA") {
        value = field.value.split('\n').filter(s => s.trim());
    } else if (field.tagName == "SELECT") {
        value = u.getSelectValues(field);
    } else {
        value = field.value;
    }
    return { name, value };
}


function getInputType(field) {
    const type = XFORM_TYPE_MAP[field.getAttribute('type')]
    if (type == 'text') {
        const datatypes = field.getElementsByTagNameNS("http://jabber.org/protocol/xdata-validate", "validate");
        if (datatypes.length === 1) {
            const datatype = datatypes[0].getAttribute("datatype");
            return XFORM_VALIDATE_TYPE_MAP[datatype] || type;
        }
    }
    return type;
}

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
 * @param { String } url
 * @returns { String }
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
 * @returns {integer}
 */
u.calculateElementHeight = function (el) {
    return Array.from(el.children).reduce((result, child) => result + child.offsetHeight, 0);
};

u.getNextElement = function (el, selector = '*') {
    let next_el = el.nextElementSibling;
    while (next_el !== null && !sizzle.matchesSelector(next_el, selector)) {
        next_el = next_el.nextElementSibling;
    }
    return next_el;
};

u.getPreviousElement = function (el, selector = '*') {
    let prev_el = el.previousElementSibling;
    while (prev_el !== null && !sizzle.matchesSelector(prev_el, selector)) {
        prev_el = prev_el.previousElementSibling;
    }
    return prev_el;
};

u.getFirstChildElement = function (el, selector = '*') {
    let first_el = el.firstElementChild;
    while (first_el !== null && !sizzle.matchesSelector(first_el, selector)) {
        first_el = first_el.nextElementSibling;
    }
    return first_el;
};

u.getLastChildElement = function (el, selector = '*') {
    let last_el = el.lastElementChild;
    while (last_el !== null && !sizzle.matchesSelector(last_el, selector)) {
        last_el = last_el.previousElementSibling;
    }
    return last_el;
};

u.hasClass = function (className, el) {
    return el instanceof Element && el.classList.contains(className);
};

u.toggleClass = function (className, el) {
    u.hasClass(className, el) ? u.removeClass(className, el) : u.addClass(className, el);
};

/**
 * Add a class to an element.
 * @method u#addClass
 * @param {string} className
 * @param {Element} el
 */
u.addClass = function (className, el) {
    el instanceof Element && el.classList.add(className);
    return el;
};

/**
 * Remove a class from an element.
 * @method u#removeClass
 * @param {string} className
 * @param {Element} el
 */
u.removeClass = function (className, el) {
    el instanceof Element && el.classList.remove(className);
    return el;
};

u.removeElement = function (el) {
    el instanceof Element && el.parentNode && el.parentNode.removeChild(el);
    return el;
};

u.getElementFromTemplateResult = function (tr) {
    const div = document.createElement('div');
    render(tr, div);
    return div.firstElementChild;
};

u.showElement = el => {
    u.removeClass('collapsed', el);
    u.removeClass('hidden', el);
};

u.hideElement = function (el) {
    el instanceof Element && el.classList.add('hidden');
    return el;
};

export function ancestor (el, selector) {
    let parent = el;
    while (parent !== null && !sizzle.matchesSelector(parent, selector)) {
        parent = parent.parentElement;
    }
    return parent;
}

/**
 * Return the element's siblings until one matches the selector.
 * @private
 * @method u#nextUntil
 * @param { HTMLElement } el
 * @param { String } selector
 */
u.nextUntil = function (el, selector) {
    const matches = [];
    let sibling_el = el.nextElementSibling;
    while (sibling_el !== null && !sibling_el.matches(selector)) {
        matches.push(sibling_el);
        sibling_el = sibling_el.nextElementSibling;
    }
    return matches;
};

/**
 * Helper method that replace HTML-escaped symbols with equivalent characters
 * (e.g. transform occurrences of '&amp;' to '&')
 * @private
 * @method u#unescapeHTML
 * @param { String } string - a String containing the HTML-escaped symbols.
 */
u.unescapeHTML = function (string) {
    var div = document.createElement('div');
    div.innerHTML = string;
    return div.innerText;
};

u.escapeHTML = function (string) {
    return string
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

function isProtocolApproved (protocol, safeProtocolsList = APPROVED_URL_PROTOCOLS) {
    return !!safeProtocolsList.includes(protocol);
}

// Will return false if URL is malformed or contains disallowed characters
function isUrlValid (urlString) {
    try {
        const url = new URL(urlString);
        return !!url;
    } catch (error) {
        return false;
    }
}

export function getHyperlinkTemplate (url) {
    const http_url = RegExp('^w{3}.', 'ig').test(url) ? `http://${url}` : url;
    const uri = getURI(url);
    if (uri !== null && isUrlValid(http_url) && (isProtocolApproved(uri._parts.protocol) || !uri._parts.protocol)) {
        return tplHyperlink(uri, url);
    }
    return url;
}

u.slideInAllElements = function (elements, duration = 300) {
    return Promise.all(Array.from(elements).map(e => u.slideIn(e, duration)));
};

u.slideToggleElement = function (el, duration) {
    if (u.hasClass('collapsed', el) || u.hasClass('hidden', el)) {
        return u.slideOut(el, duration);
    } else {
        return u.slideIn(el, duration);
    }
};

/**
 * Shows/expands an element by sliding it out of itself
 * @method slideOut
 * @param { HTMLElement } el - The HTML string
 * @param { Number } duration - The duration amount in milliseconds
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
        if (marker) {
            el.removeAttribute('data-slider-marker');
            window.cancelAnimationFrame(marker);
        }
        const end_height = u.calculateElementHeight(el);
        if (window.converse_disable_effects) {
            // Effects are disabled (for tests)
            el.style.height = end_height + 'px';
            slideOutWrapup(el);
            resolve();
            return;
        }
        if (!u.hasClass('collapsed', el) && !u.hasClass('hidden', el)) {
            resolve();
            return;
        }

        const steps = duration / 17; // We assume 17ms per animation which is ~60FPS
        let height = 0;

        function draw () {
            height += end_height / steps;
            if (height < end_height) {
                el.style.height = height + 'px';
                el.setAttribute('data-slider-marker', window.requestAnimationFrame(draw));
            } else {
                // We recalculate the height to work around an apparent
                // browser bug where browsers don't know the correct
                // offsetHeight beforehand.
                el.removeAttribute('data-slider-marker');
                el.style.height = u.calculateElementHeight(el) + 'px';
                el.style.overflow = '';
                el.style.height = '';
                resolve();
            }
        }
        el.style.height = '0';
        el.style.overflow = 'hidden';
        el.classList.remove('hidden');
        el.classList.remove('collapsed');
        el.setAttribute('data-slider-marker', window.requestAnimationFrame(draw));
    });
}

/**
 * Hides/contracts an element by sliding it into itself
 * @method slideIn
 * @param { HTMLElement } el - The HTML string
 * @param { Number } duration - The duration amount in milliseconds
 */
export function slideIn (el, duration = 200) {
    return new Promise((resolve, reject) => {
        if (!el) {
            const err = 'An element needs to be passed in to slideIn';
            log.warn(err);
            return reject(new Error(err));
        } else if (u.hasClass('collapsed', el)) {
            return resolve(el);
        } else if (window.converse_disable_effects) {
            // Effects are disabled (for tests)
            el.classList.add('collapsed');
            el.style.height = '';
            return resolve(el);
        }
        const marker = el.getAttribute('data-slider-marker');
        if (marker) {
            el.removeAttribute('data-slider-marker');
            window.cancelAnimationFrame(marker);
        }
        const original_height = el.offsetHeight,
            steps = duration / 17; // We assume 17ms per animation which is ~60FPS
        let height = original_height;

        el.style.overflow = 'hidden';

        function draw () {
            height -= original_height / steps;
            if (height > 0) {
                el.style.height = height + 'px';
                el.setAttribute('data-slider-marker', window.requestAnimationFrame(draw));
            } else {
                el.removeAttribute('data-slider-marker');
                el.classList.add('collapsed');
                el.style.height = '';
                resolve(el);
            }
        }
        el.setAttribute('data-slider-marker', window.requestAnimationFrame(draw));
    });
}

function afterAnimationEnds (el, callback) {
    el.classList.remove('visible');
    if (isFunction(callback)) {
        callback();
    }
}

u.isInDOM = function (el) {
    return document.querySelector('body').contains(el);
};

u.isVisible = function (el) {
    if (el === null) {
        return false;
    }
    if (u.hasClass('hidden', el)) {
        return false;
    }
    // XXX: Taken from jQuery's "visible" implementation
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
};

u.fadeIn = function (el, callback) {
    if (!el) {
        log.warn('An element needs to be passed in to fadeIn');
    }
    if (window.converse_disable_effects) {
        el.classList.remove('hidden');
        return afterAnimationEnds(el, callback);
    }
    if (u.hasClass('hidden', el)) {
        el.classList.add('visible');
        el.classList.remove('hidden');
        el.addEventListener('webkitAnimationEnd', () => afterAnimationEnds(el, callback));
        el.addEventListener('animationend', () => afterAnimationEnds(el, callback));
        el.addEventListener('oanimationend', () => afterAnimationEnds(el, callback));
    } else {
        afterAnimationEnds(el, callback);
    }
};

/**
 * Takes an XML field in XMPP XForm (XEP-004: Data Forms) format returns a
 * [TemplateResult](https://lit.polymer-project.org/api/classes/_lit_html_.templateresult.html).
 * @method u#xForm2TemplateResult
 * @param { XMLElement } field - the field to convert
 * @param { XMLElement } stanza - the containing stanza
 * @param { Object } options
 * @returns { TemplateResult }
 */
u.xForm2TemplateResult = function (field, stanza, options={}) {
    if (field.getAttribute('type') === 'list-single' || field.getAttribute('type') === 'list-multi') {
        const values = u.queryChildren(field, 'value').map(el => el?.textContent);
        const options = u.queryChildren(field, 'option').map(option => {
            const value = option.querySelector('value')?.textContent;
            return {
                'value': value,
                'label': option.getAttribute('label'),
                'selected': values.includes(value),
                'required': !!field.querySelector('required')
            };
        });
        return tplFormSelect({
            options,
            'id': u.getUniqueId(),
            'label': field.getAttribute('label'),
            'multiple': field.getAttribute('type') === 'list-multi',
            'name': field.getAttribute('var'),
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('type') === 'fixed') {
        const text = field.querySelector('value')?.textContent;
        return tplFormHelp({ text });
    } else if (field.getAttribute('type') === 'jid-multi') {
        return tplFormTextarea({
            'name': field.getAttribute('var'),
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent,
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('type') === 'boolean') {
        const value = field.querySelector('value')?.textContent;
        return tplFormCheckbox({
            'id': u.getUniqueId(),
            'name': field.getAttribute('var'),
            'label': field.getAttribute('label') || '',
            'checked': ((value === '1' || value === 'true') && 'checked="1"') || ''
        });
    } else if (field.getAttribute('var') === 'url') {
        return tplFormUrl({
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent
        });
    } else if (field.getAttribute('var') === 'username') {
        return tplFormUsername({
            'domain': ' @' + options.domain,
            'name': field.getAttribute('var'),
            'type': getInputType(field),
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent,
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('var') === 'password') {
        return tplFormInput({
            'name': field.getAttribute('var'),
            'type': 'password',
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent,
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('var') === 'ocr') {
        // Captcha
        const uri = field.querySelector('uri');
        const el = sizzle('data[cid="' + uri.textContent.replace(/^cid:/, '') + '"]', stanza)[0];
        return tplFormCaptcha({
            'label': field.getAttribute('label'),
            'name': field.getAttribute('var'),
            'data': el?.textContent,
            'type': uri.getAttribute('type'),
            'required': !!field.querySelector('required')
        });
    } else {
        const name = field.getAttribute('var');
        return tplFormInput({
            'id': u.getUniqueId(),
            'label': field.getAttribute('label') || '',
            'name': name,
            'fixed_username': options?.fixed_username,
            'autocomplete': getAutoCompleteProperty(name, options),
            'placeholder': null,
            'required': !!field.querySelector('required'),
            'type': getInputType(field),
            'value': field.querySelector('value')?.textContent
        });
    }
};

Object.assign(u, { getOOBURLMarkup, ancestor, slideIn, slideOut, isEqualNode });

export default u;
