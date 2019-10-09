// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// This is a form utilities module.
//
// Copyright (c) 2013-2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)

import URI from "urijs";
import _ from "../headless/lodash.noconflict";
import sizzle from "sizzle";
import tpl_audio from  "../templates/audio.html";
import tpl_file from "../templates/file.html";
import tpl_form_captcha from "../templates/form_captcha.html";
import tpl_form_checkbox from "../templates/form_checkbox.html";
import tpl_form_input from "../templates/form_input.html";
import tpl_form_select from "../templates/form_select.html";
import tpl_form_textarea from "../templates/form_textarea.html";
import tpl_form_url from "../templates/form_url.html";
import tpl_form_username from "../templates/form_username.html";
import tpl_image from "../templates/image.html";
import tpl_select_option from "../templates/select_option.html";
import tpl_video from "../templates/video.html";
import u from "../headless/utils/core";

const URL_REGEX = /\b(https?\:\/\/|www\.|https?:\/\/www\.)[^\s<>]{2,200}\b\/?/g;

function getAutoCompleteProperty (name, options) {
    return {
        'muc#roomconfig_lang': 'language',
        'muc#roomconfig_roomsecret': options.new_password ? 'new-password' : 'current-password'
    }[name];
}

const logger = _.assign({
    'debug': _.get(console, 'log') ? console.log.bind(console) : function noop () {},
    'error': _.get(console, 'log') ? console.log.bind(console) : function noop () {},
    'info': _.get(console, 'log') ? console.log.bind(console) : function noop () {},
    'warn': _.get(console, 'log') ? console.log.bind(console) : function noop () {}
}, console);

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


const isImage = function (url) {
    return new Promise((resolve, reject) => {
        var img = new Image();
        var timer = window.setTimeout(function () {
            reject(new Error("Could not determine whether it's an image"));
            img = null;
        }, 3000);
        img.onerror = img.onabort = function () {
            clearTimeout(timer);
            reject(new Error("Could not determine whether it's an image"));
        };
        img.onload = function () {
            clearTimeout(timer);
            resolve(img);
        };
        img.src = url;
    });
};


u.isAudioURL = function (url) {
    if (!(url instanceof URI)) {
        url = new URI(url);
    }
    const filename = url.filename().toLowerCase();
    if (url.protocol().toLowerCase() !== "https") {
        return false;
    }
    return filename.endsWith('.ogg') || filename.endsWith('.mp3') || filename.endsWith('.m4a');
}


u.isImageURL = function (url) {
    if (!(url instanceof URI)) {
        url = new URI(url);
    }
    const filename = url.filename().toLowerCase();
    if (window.location.protocol === 'https:' && url.protocol().toLowerCase() !== "https") {
        return false;
    }
    return filename.endsWith('.jpg') || filename.endsWith('.jpeg') ||
           filename.endsWith('.png') || filename.endsWith('.gif') ||
           filename.endsWith('.bmp') || filename.endsWith('.tiff') ||
           filename.endsWith('.svg');
};


u.isVideoURL = function (url) {
    if (!(url instanceof URI)) {
        url = new URI(url);
    }
    const filename = url.filename().toLowerCase();
    if (url.protocol().toLowerCase() !== "https") {
        return false;
    }
    return filename.endsWith('.mp4') || filename.endsWith('.webm');
}


u.renderAudioURL = function (_converse, url) {
    const uri = new URI(url);
    if (u.isAudioURL(uri)) {
        const { __ } = _converse;
        return tpl_audio({
            'url': url,
            'label_download': __('Download audio file "%1$s"', decodeURI(uri.filename()))
        })
    }
    return url;
};


u.renderFileURL = function (_converse, url) {
    const uri = new URI(url);
    if (u.isImageURL(uri) || u.isVideoURL(uri) || u.isAudioURL(uri)) {
        return url;
    }
    const { __ } = _converse,
          filename = uri.filename();
    return tpl_file({
        'url': url,
        'label_download': __('Download file "%1$s"', decodeURI(filename))
    })
};

u.renderImageURL = function (_converse, url) {
    if (!_converse.show_images_inline) {
        return u.addHyperlinks(url);
    }
    const uri = new URI(url);
    if (u.isImageURL(uri)) {
        const { __ } = _converse;
        return tpl_image({
            'url': url,
            'label_download': __('Download image "%1$s"', decodeURI(uri.filename()))
        })
    }
    return url;
};


/**
 * Returns a Promise which resolves once all images have been loaded.
 * @returns {Promise}
 */
u.renderImageURLs = function (_converse, el) {
    if (!_converse.show_images_inline) {
        return Promise.resolve();
    }
    const list = el.textContent.match(URL_REGEX) || [];
    return Promise.all(
        list.map(url =>
            new Promise((resolve) => {
                if (u.isImageURL(url)) {
                    return isImage(url).then(img => {
                        const i = new Image();
                        i.src = img.src;
                        i.addEventListener('load', resolve);
                        // We also resolve (instead of reject) for non-images,
                        // otherwise the Promise.all resolves prematurely.
                        i.addEventListener('error', resolve);
                        const { __ } = _converse;
                        sizzle(`a[href="${url}"]`, el)
                            .forEach(a => (a.outerHTML = tpl_image({url, 'label_download': __('Download')})));
                    }).catch(resolve)
                } else {
                    return resolve();
                }
            })
        )
    )
};


u.renderMovieURL = function (_converse, url) {
    const uri = new URI(url);
    if (u.isVideoURL(uri)) {
        const { __ } = _converse;
        return tpl_video({
            'url': url,
            'label_download': __('Download video file "%1$s"', decodeURI(uri.filename()))
        })
    }
    return url;
};


u.renderNewLines = function (text) {
    return text.replace(/\n\n+/g, '<br/><br/>').replace(/\n/g, '<br/>');
};

u.calculateElementHeight = function (el) {
    /* Return the height of the passed in DOM element,
     * based on the heights of its children.
     */
    return _.reduce(
        el.children,
        (result, child) => result + child.offsetHeight, 0
    );
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

u.addClass = function (className, el) {
    (el instanceof Element) && el.classList.add(className);
    return el;
}

u.removeClass = function (className, el) {
    (el instanceof Element) && el.classList.remove(className);
    return el;
}

u.removeElement = function (el) {
    (el instanceof Element) && el.parentNode && el.parentNode.removeChild(el);
    return el;
}

u.showElement = _.flow(
    _.partial(u.removeClass, 'collapsed'),
    _.partial(u.removeClass, 'hidden')
)

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


u.addMentionsMarkup = function (text, references, chatbox) {
    if (chatbox.get('message_type') !== 'groupchat') {
        return text;
    }
    const nick = chatbox.get('nick');
    references
        .sort((a, b) => b.begin - a.begin)
        .forEach(ref => {
            const mention = text.slice(ref.begin, ref.end)
            chatbox;
            if (mention === nick) {
                text = text.slice(0, ref.begin) + `<span class="mention mention--self badge badge-info">${mention}</span>` + text.slice(ref.end);
            } else {
                text = text.slice(0, ref.begin) + `<span class="mention">${mention}</span>` + text.slice(ref.end);
            }
        });
    return text;
};


u.addHyperlinks = function (text) {
    return URI.withinString(text, url => {
        const uri = new URI(url);
        url = uri.normalize()._string;
        const pretty_url = uri._parts.urn ? url : uri.readable();
        if (!uri._parts.protocol && !url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        if (uri._parts.protocol === 'xmpp' && uri._parts.query === 'join') {
            return `<a target="_blank" rel="noopener" class="open-chatroom" href="${url}">${u.escapeHTML(pretty_url)}</a>`;
        }
        return `<a target="_blank" rel="noopener" href="${url}">${u.escapeHTML(pretty_url)}</a>`;
    }, {
        'start': /\b(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi
    });
};


u.slideInAllElements = function (elements, duration=300) {
    return Promise.all(
        _.map(
            elements,
            _.partial(u.slideIn, _, duration)
        ));
};

u.slideToggleElement = function (el, duration) {
    if (_.includes(el.classList, 'collapsed') ||
            _.includes(el.classList, 'hidden')) {
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
            logger.warn(err);
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
            logger.warn(err);
            return reject(new Error(err));
        } else if (_.includes(el.classList, 'collapsed')) {
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
    if (_.isFunction(callback)) {
        callback();
    }
}

u.isInDOM = function (el) {
    return document.querySelector('body').contains(el);
}

u.isVisible = function (el) {
    if (u.hasClass('hidden', el)) {
        return false;
    }
    // XXX: Taken from jQuery's "visible" implementation
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
};


u.fadeIn = function (el, callback) {
    if (!el) {
        logger.warn("An element needs to be passed in to fadeIn");
    }
    if (window.converse_disable_effects) {
        el.classList.remove('hidden');
        return afterAnimationEnds(el, callback);
    }
    if (_.includes(el.classList, 'hidden')) {
        el.classList.add('visible');
        el.classList.remove('hidden');
        el.addEventListener("webkitAnimationEnd", _.partial(afterAnimationEnds, el, callback));
        el.addEventListener("animationend", _.partial(afterAnimationEnds, el, callback));
        el.addEventListener("oanimationend", _.partial(afterAnimationEnds, el, callback));
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

        const values = _.map(
            u.queryChildren(field, 'value'),
            _.partial(_.get, _, 'textContent')
        );
        const options = _.map(
            u.queryChildren(field, 'option'),
            function (option) {
                const value = _.get(option.querySelector('value'), 'textContent');
                return tpl_select_option({
                    'value': value,
                    'label': option.getAttribute('label'),
                    'selected': _.includes(values, value),
                    'required': !!field.querySelector('required')
                })
            }
        );
        return tpl_form_select({
            'id': u.getUniqueId(),
            'name': field.getAttribute('var'),
            'label': field.getAttribute('label'),
            'options': options.join(''),
            'multiple': (field.getAttribute('type') === 'list-multi'),
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('type') === 'fixed') {
        const text = _.get(field.querySelector('value'), 'textContent');
        return '<p class="form-help">'+text+'</p>';
    } else if (field.getAttribute('type') === 'jid-multi') {
        return tpl_form_textarea({
            'name': field.getAttribute('var'),
            'label': field.getAttribute('label') || '',
            'value': _.get(field.querySelector('value'), 'textContent'),
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('type') === 'boolean') {
        return tpl_form_checkbox({
            'id': u.getUniqueId(),
            'name': field.getAttribute('var'),
            'label': field.getAttribute('label') || '',
            'checked': _.get(field.querySelector('value'), 'textContent') === "1" && 'checked="1"' || '',
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('var') === 'url') {
        return tpl_form_url({
            'label': field.getAttribute('label') || '',
            'value': _.get(field.querySelector('value'), 'textContent')
        });
    } else if (field.getAttribute('var') === 'username') {
        return tpl_form_username({
            'domain': ' @'+options.domain,
            'name': field.getAttribute('var'),
            'type': XFORM_TYPE_MAP[field.getAttribute('type')],
            'label': field.getAttribute('label') || '',
            'value': _.get(field.querySelector('value'), 'textContent'),
            'required': !!field.querySelector('required')
        });
    } else if (field.getAttribute('var') === 'ocr') { // Captcha
        const uri = field.querySelector('uri');
        const el = sizzle('data[cid="'+uri.textContent.replace(/^cid:/, '')+'"]', stanza)[0];
        return tpl_form_captcha({
            'label': field.getAttribute('label'),
            'name': field.getAttribute('var'),
            'data': _.get(el, 'textContent'),
            'type': uri.getAttribute('type'),
            'required': !!field.querySelector('required')
        });
    } else {
        const name = field.getAttribute('var');
        return tpl_form_input({
            'id': u.getUniqueId(),
            'label': field.getAttribute('label') || '',
            'name': name,
            'fixed_username': options.fixed_username,
            'autocomplete': getAutoCompleteProperty(name, options),
            'placeholder': null,
            'required': !!field.querySelector('required'),
            'type': XFORM_TYPE_MAP[field.getAttribute('type')],
            'value': _.get(field.querySelector('value'), 'textContent')
        });
    }
}
export default u;
