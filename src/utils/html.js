/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the DOM/HTML utilities module.
 */
import isFunction from 'lodash-es/isFunction';
import log from '@converse/headless/log';
import tpl_audio from 'templates/audio.js';
import tpl_file from 'templates/file.js';
import tpl_form_captcha from '../templates/form_captcha.js';
import tpl_form_checkbox from '../templates/form_checkbox.js';
import tpl_form_help from '../templates/form_help.js';
import tpl_form_input from '../templates/form_input.js';
import tpl_form_select from '../templates/form_select.js';
import tpl_form_textarea from '../templates/form_textarea.js';
import tpl_form_url from '../templates/form_url.js';
import tpl_form_username from '../templates/form_username.js';
import tpl_hyperlink from 'templates/hyperlink.js';
import tpl_video from 'templates/video.js';
import u from '../headless/utils/core';
import { converse } from '@converse/headless/core';
import { getURI, isAudioURL, isImageURL, isVideoURL } from '@converse/headless/utils/url.js';
import { render } from 'lit';

const { sizzle } = converse.env;

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

function getFileName (uri) {
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
        return tpl_video(url);
    } else if (isAudioURL(uri)) {
        return tpl_audio(url);
    } else if (isImageURL(uri)) {
        return tpl_file(uri.toString(), getFileName(uri));
    } else {
        return tpl_file(uri.toString(), getFileName(uri));
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
        return tpl_hyperlink(uri, url);
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
 * @private
 * @method u#slideOut
 * @param { HTMLElement } el - The HTML string
 * @param { Number } duration - The duration amount in milliseconds
 */
u.slideOut = function (el, duration = 200) {
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
};

u.slideIn = function (el, duration = 200) {
    /* Hides/collapses an element by sliding it into itself. */
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
};

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
u.xForm2TemplateResult = function (field, stanza, options) {
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
        return tpl_form_select({
            options,
            'id': u.getUniqueId(),
            'label': field.getAttribute('label'),
            'multiple': field.getAttribute('type') === 'list-multi',
            'name': field.getAttribute('var'),
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('type') === 'fixed') {
        const text = field.querySelector('value')?.textContent;
        return tpl_form_help({ text });
    } else if (field.getAttribute('type') === 'jid-multi') {
        return tpl_form_textarea({
            'name': field.getAttribute('var'),
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent,
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('type') === 'boolean') {
        const value = field.querySelector('value')?.textContent;
        return tpl_form_checkbox({
            'id': u.getUniqueId(),
            'name': field.getAttribute('var'),
            'label': field.getAttribute('label') || '',
            'checked': ((value === '1' || value === 'true') && 'checked="1"') || '',
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('var') === 'url') {
        return tpl_form_url({
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent
        });
    } else if (field.getAttribute('var') === 'username') {
        return tpl_form_username({
            'domain': ' @' + options.domain,
            'name': field.getAttribute('var'),
            'type': getInputType(field),
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent,
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('var') === 'ocr') {
        // Captcha
        const uri = field.querySelector('uri');
        const el = sizzle('data[cid="' + uri.textContent.replace(/^cid:/, '') + '"]', stanza)[0];
        return tpl_form_captcha({
            'label': field.getAttribute('label'),
            'name': field.getAttribute('var'),
            'data': el?.textContent,
            'type': uri.getAttribute('type'),
            'required': !!field.querySelector('required')
        });
    } else {
        const name = field.getAttribute('var');
        return tpl_form_input({
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

Object.assign(u, { getOOBURLMarkup, ancestor });

export default u;
