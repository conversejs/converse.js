/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the DOM/HTML utilities module.
 */
import URI from "urijs";
import log from '@converse/headless/log';
import sizzle from "sizzle";
import tpl_audio from  "../templates/audio.js";
import tpl_file from "../templates/file.js";
import tpl_form_captcha from "../templates/form_captcha.html";
import tpl_form_checkbox from "../templates/form_checkbox.html";
import tpl_form_input from "../templates/form_input.html";
import tpl_form_select from "../templates/form_select.html";
import tpl_form_textarea from "../templates/form_textarea.html";
import tpl_form_url from "../templates/form_url.html";
import tpl_form_username from "../templates/form_username.html";
import tpl_image from "../templates/image.js";
import tpl_select_option from "../templates/select_option.html";
import tpl_video from "../templates/video.js";
import u from "../headless/utils/core";
import { api } from  "@converse/headless/converse-core";
import { html, render } from "lit-html";
import { isFunction } from "lodash-es";

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

function slideOutWrapup (el) {
    /* Wrapup function for slideOut. */
    el.removeAttribute('data-slider-marker');
    el.classList.remove('collapsed');
    el.style.overflow = "";
    el.style.height = "";
}

function getURI (url) {
    try {
        return (url instanceof URI) ? url : (new URI(url));
    } catch (error) {
        log.debug(error);
        return null;
    }
}

function checkTLS (uri) {
    return window.location.protocol === 'http:' ||
           window.location.protocol === 'https:' && uri.protocol().toLowerCase() === "https";
}

function checkFileTypes (types, url) {
    const uri = getURI(url);
    if (uri === null || !checkTLS(uri)) {
        return false;
    }
    const filename = uri.filename().toLowerCase();
    return !!types.filter(ext => filename.endsWith(ext)).length;
}

u.isAudioURL = url => checkFileTypes(['.ogg', '.mp3', '.m4a'], url);
u.isVideoURL = url => checkFileTypes(['.mp4', '.webm'], url);

u.isURLWithImageExtension = url => checkFileTypes(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg'], url);

u.isImageURL = url => {
    const regex = api.settings.get('image_urls_regex');
    return regex?.test(url) || u.isURLWithImageExtension(url);
}
u.isImageDomainAllowed = url => {
    const show_images_inline = api.settings.get('show_images_inline');
    if (!Array.isArray(show_images_inline)) {
        return true;
    }
    try {
        const image_domain = getURI(url).domain();
        return show_images_inline.includes(image_domain);
    } catch (error) {
        log.debug(error);
        return true;
    }
}

function getFileName (uri) {
    try {
        return decodeURI(uri.filename());
    } catch (error) {
        log.debug(error);
        return uri.filename();
    }
}

function renderAudioURL (_converse, uri) {
    const { __ } = _converse;
    return tpl_audio({
        'url': uri.toString(),
        'label_download': __('Download audio file "%1$s"', getFileName(uri))
    })
}

function renderImageURL (_converse, uri) {
    const { __ } = _converse;
    return tpl_file({
        'url': uri.toString(),
        'label_download': __('Download image file "%1$s"', getFileName(uri))
    })
}

function renderFileURL (_converse, uri) {
    const { __ } = _converse;
    return tpl_file({
        'url': uri.toString(),
        'label_download': __('Download file "%1$s"', getFileName(uri))
    })
}

/**
 * Returns the markup for a URL that points to a downloadable asset
 * (such as a video, image or audio file).
 * @method u#getOOBURLMarkup
 * @param { String } url
 * @returns { String }
 */
u.getOOBURLMarkup = function (_converse, url) {
    const uri = getURI(url);
    if (uri === null) {
        return url;
    }
    if (u.isVideoURL(uri)) {
        return tpl_video({url})
    } else if (u.isAudioURL(uri)) {
        return renderAudioURL(_converse, uri);
    } else if (u.isImageURL(uri)) {
        return renderImageURL(_converse, uri);
    } else {
        return renderFileURL(_converse, uri);
    }
}


/**
 * Applies some resistance to `value` around the `default_value`.
 * If value is close enough to `default_value`, then it is returned, otherwise
 * `value` is returned.
 * @method u#applyDragResistance
 * @param { Integer } value
 * @param { Integer } default_value
 * @returns { Integer }
 */
u.applyDragResistance = function (value, default_value) {
    if (value === undefined) {
        return undefined;
    } else if (default_value === undefined) {
        return value;
    }
    const resistance = 10;
    if ((value !== default_value) &&
        (Math.abs(value- default_value) < resistance)) {
        return default_value;
    }
    return value;
};


/**
 * Return the height of the passed in DOM element,
 * based on the heights of its children.
 * @method u#calculateElementHeight
 * @param {HTMLElement} el
 * @returns {integer}
 */
u.calculateElementHeight = function (el) {
    return Array.from(el.children).reduce((result, child) => result + child.offsetHeight, 0);
}

u.getNextElement = function (el, selector='*') {
    let next_el = el.nextElementSibling;
    while (next_el !== null && !sizzle.matchesSelector(next_el, selector)) {
        next_el = next_el.nextElementSibling;
    }
    return next_el;
}

u.getPreviousElement = function (el, selector='*') {
    let prev_el = el.previousElementSibling;
    while (prev_el !== null && !sizzle.matchesSelector(prev_el, selector)) {
        prev_el = prev_el.previousElementSibling
    }
    return prev_el;
}

u.getFirstChildElement = function (el, selector='*') {
    let first_el = el.firstElementChild;
    while (first_el !== null && !sizzle.matchesSelector(first_el, selector)) {
        first_el = first_el.nextElementSibling
    }
    return first_el;
}

u.getLastChildElement = function (el, selector='*') {
    let last_el = el.lastElementChild;
    while (last_el !== null && !sizzle.matchesSelector(last_el, selector)) {
        last_el = last_el.previousElementSibling
    }
    return last_el;
}

u.hasClass = function (className, el) {
    return (el instanceof Element) && el.classList.contains(className);
};


u.toggleClass = function (className, el) {
    u.hasClass(className, el) ? u.removeClass(className, el) : u.addClass(className, el);
}

/**
 * Add a class to an element.
 * @method u#addClass
 * @param {string} className
 * @param {Element} el
 */
u.addClass = function (className, el) {
    (el instanceof Element) && el.classList.add(className);
    return el;
}

/**
 * Remove a class from an element.
 * @method u#removeClass
 * @param {string} className
 * @param {Element} el
 */
u.removeClass = function (className, el) {
    (el instanceof Element) && el.classList.remove(className);
    return el;
}

u.removeElement = function (el) {
    (el instanceof Element) && el.parentNode && el.parentNode.removeChild(el);
    return el;
}

u.getElementFromTemplateResult = function (tr) {
    const div = document.createElement('div');
    render(tr, div);
    return div.firstElementChild;
}

u.showElement = el => {
    u.removeClass('collapsed', el);
    u.removeClass('hidden', el);
}

u.hideElement = function (el) {
    (el instanceof Element) && el.classList.add('hidden');
    return el;
}

u.ancestor = function (el, selector) {
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
}

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
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
};

u.convertToImageTag = function (url, onLoad, onClick) {
    return tpl_image({url, onClick, onLoad});
};

u.convertURIoHyperlink = function (uri, urlAsTyped) {
    let normalized_url = uri.normalize()._string;
    const pretty_url = uri._parts.urn ? normalized_url : uri.readable();
    const visible_url = urlAsTyped || pretty_url;
    if (!uri._parts.protocol && !normalized_url.startsWith('http://') && !normalized_url.startsWith('https://')) {
        normalized_url = 'http://' + normalized_url;
    }
    if (uri._parts.protocol === 'xmpp' && uri._parts.query === 'join') {
        return html`
            <a target="_blank"
               rel="noopener"
               @click=${ev => api.rooms.open(ev.target.href)}
               href="${normalized_url}">${visible_url}</a>`;
    }
    return html`<a target="_blank" rel="noopener" href="${normalized_url}">${visible_url}</a>`;
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

u.convertUrlToHyperlink = function (url) {
    const http_url = RegExp('^w{3}.', 'ig').test(url) ? `http://${url}` : url;
    const uri = getURI(url);
    if (uri !== null && isUrlValid(http_url) && (isProtocolApproved(uri._parts.protocol) || !uri._parts.protocol)) {
        return this.convertURIoHyperlink(uri, url);
    }
    return url;
};

u.filterQueryParamsFromURL = function (url) {
    const paramsArray = api.settings.get("filter_url_query_params");
    if (!paramsArray) return url;
    const parsed_uri = getURI(url);
    return parsed_uri.removeQuery(paramsArray).toString();
};

u.addHyperlinks = function (text) {
    const objs = [];
    const parse_options = { 'start': /\b(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi };
    try {
        URI.withinString(text, (url, start, end) => {
            objs.push({url, start, end})
            return url;
        } , parse_options);
    } catch (error) {
        log.debug(error);
        return [text];
    }

    let list = [text];
    if (objs.length) {
        objs.sort((a, b) => b.start - a.start)
            .forEach(url_obj => {
                const text = list.shift();
                const url_text = text.slice(url_obj.start, url_obj.end);
                list = [
                    text.slice(0, url_obj.start),
                    u.convertUrlToHyperlink(url_text),
                    text.slice(url_obj.end),
                    ...list
                ];
            });
    } else {
        list = [text];
    }
    return list;
}

u.httpToGeoUri = function(text, _converse) {
    const replacement = 'geo:$1,$2';
    return text.replace(_converse.api.settings.get("geouri_regex"), replacement);
};

u.slideInAllElements = function (elements, duration=300) {
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
u.slideOut = function (el, duration=200) {
    return new Promise((resolve, reject) => {
        if (!el) {
            const err = "An element needs to be passed in to slideOut"
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
        if (window.converse_disable_effects) { // Effects are disabled (for tests)
            el.style.height = end_height + 'px';
            slideOutWrapup(el);
            resolve();
            return;
        }
        if (!u.hasClass('collapsed', el) && !u.hasClass('hidden', el)) {
            resolve();
            return;
        }

        const steps = duration/17; // We assume 17ms per animation which is ~60FPS
        let height = 0;

        function draw () {
            height += end_height/steps;
            if (height < end_height) {
                el.style.height = height + 'px';
                el.setAttribute(
                    'data-slider-marker',
                    window.requestAnimationFrame(draw)
                );
            } else {
                // We recalculate the height to work around an apparent
                // browser bug where browsers don't know the correct
                // offsetHeight beforehand.
                el.removeAttribute('data-slider-marker');
                el.style.height = u.calculateElementHeight(el) + 'px';
                el.style.overflow = "";
                el.style.height = "";
                resolve();
            }
        }
        el.style.height = '0';
        el.style.overflow = 'hidden';
        el.classList.remove('hidden');
        el.classList.remove('collapsed');
        el.setAttribute(
            'data-slider-marker',
            window.requestAnimationFrame(draw)
        );
    });
};

u.slideIn = function (el, duration=200) {
    /* Hides/collapses an element by sliding it into itself. */
    return new Promise((resolve, reject) => {
        if (!el) {
            const err = "An element needs to be passed in to slideIn";
            log.warn(err);
            return reject(new Error(err));
        } else if (u.hasClass('collapsed', el)) {
            return resolve(el);
        } else if (window.converse_disable_effects) { // Effects are disabled (for tests)
            el.classList.add('collapsed');
            el.style.height = "";
            return resolve(el);
        }
        const marker = el.getAttribute('data-slider-marker');
        if (marker) {
            el.removeAttribute('data-slider-marker');
            window.cancelAnimationFrame(marker);
        }
        const original_height = el.offsetHeight,
             steps = duration/17; // We assume 17ms per animation which is ~60FPS
        let height = original_height;

        el.style.overflow = 'hidden';

        function draw () {
            height -= original_height/steps;
            if (height > 0) {
                el.style.height = height + 'px';
                el.setAttribute(
                    'data-slider-marker',
                    window.requestAnimationFrame(draw)
                );
            } else {
                el.removeAttribute('data-slider-marker');
                el.classList.add('collapsed');
                el.style.height = "";
                resolve(el);
            }
        }
        el.setAttribute(
            'data-slider-marker',
            window.requestAnimationFrame(draw)
        );
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
}

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
        log.warn("An element needs to be passed in to fadeIn");
    }
    if (window.converse_disable_effects) {
        el.classList.remove('hidden');
        return afterAnimationEnds(el, callback);
    }
    if (u.hasClass('hidden', el)) {
        el.classList.add('visible');
        el.classList.remove('hidden');
        el.addEventListener("webkitAnimationEnd", () => afterAnimationEnds(el, callback));
        el.addEventListener("animationend", () => afterAnimationEnds(el, callback));
        el.addEventListener("oanimationend", () => afterAnimationEnds(el, callback));
    } else {
        afterAnimationEnds(el, callback);
    }
};


/**
 * Takes a field in XMPP XForm (XEP-004: Data Forms) format
 * and turns it into an HTML field.
 * Returns either text or a DOM element (which is not ideal, but fine for now).
 * @private
 * @method u#xForm2webForm
 * @param { XMLElement } field - the field to convert
 */
u.xForm2webForm = function (field, stanza, options) {
    if (field.getAttribute('type') === 'list-single' ||
        field.getAttribute('type') === 'list-multi') {

        const values = u.queryChildren(field, 'value').map(el => el?.textContent);
        const options = u.queryChildren(field, 'option').map(option => {
            const value = option.querySelector('value')?.textContent;
            return tpl_select_option({
                'value': value,
                'label': option.getAttribute('label'),
                'selected': values.includes(value),
                'required': !!field.querySelector('required')
            });
        });
        return tpl_form_select({
            'id': u.getUniqueId(),
            'name': field.getAttribute('var'),
            'label': field.getAttribute('label'),
            'options': options.join(''),
            'multiple': (field.getAttribute('type') === 'list-multi'),
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('type') === 'fixed') {
        const text = field.querySelector('value')?.textContent;
        return '<p class="form-help">'+text+'</p>';
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
            'checked': (value === "1" || value === "true") && 'checked="1"' || '',
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('var') === 'url') {
        return tpl_form_url({
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent
        });
    } else if (field.getAttribute('var') === 'username') {
        return tpl_form_username({
            'domain': ' @'+options.domain,
            'name': field.getAttribute('var'),
            'type': XFORM_TYPE_MAP[field.getAttribute('type')],
            'label': field.getAttribute('label') || '',
            'value': field.querySelector('value')?.textContent,
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('var') === 'ocr') { // Captcha
        const uri = field.querySelector('uri');
        const el = sizzle('data[cid="'+uri.textContent.replace(/^cid:/, '')+'"]', stanza)[0];
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
            'type': XFORM_TYPE_MAP[field.getAttribute('type')],
            'value': field.querySelector('value')?.textContent
        });
    }
}
export default u;
