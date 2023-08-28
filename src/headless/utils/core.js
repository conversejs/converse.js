/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the core utilities module.
 */
import DOMPurify from 'dompurify';
import _converse from '../shared/_converse.js';
import log from '../log.js';
import sizzle from "sizzle";
import { Model } from '@converse/skeletor/src/model.js';
import { Strophe } from 'strophe.js';
import { getOpenPromise } from '@converse/openpromise';
import { settings_api } from '../shared/settings/api.js';
import { stx , toStanza } from './stanza.js';
import {
    getCurrentWord,
    getSelectValues,
    isMentionBoundary,
    placeCaretAtEnd,
    replaceCurrentWord,
    webForm2xForm
} from './form.js';
import {
    getOuterWidth,
    isElement,
    isTagEqual,
    queryChildren,
    stringToElement,
} from './html.js';
import {
    arrayBufferToHex,
    arrayBufferToString,
    stringToArrayBuffer,
    arrayBufferToBase64,
    base64ToArrayBuffer,
} from './arraybuffer.js';
import {
    isAudioURL,
    isGIFURL,
    isVideoURL,
    isImageURL,
    isURLWithImageExtension,
    checkFileTypes,
    getURI,
    shouldRenderMediaFromURL,
    isAllowedProtocolForMedia,
} from './url.js';

/**
 * The utils object
 * @namespace u
 */
const u = {
    arrayBufferToBase64,
    arrayBufferToHex,
    arrayBufferToString,
    base64ToArrayBuffer,
    checkFileTypes,
    getSelectValues,
    getURI,
    isAllowedProtocolForMedia,
    isAudioURL,
    isGIFURL,
    isImageURL,
    isURLWithImageExtension,
    isVideoURL,
    shouldRenderMediaFromURL,
    stringToArrayBuffer,
    webForm2xForm,
};

export function isError (obj) {
    return Object.prototype.toString.call(obj) === "[object Error]";
}

export function isFunction (val) {
    return typeof val === 'function';
}

export function isEmptyMessage (attrs) {
    if (attrs instanceof Model) {
        attrs = attrs.attributes;
    }
    return !attrs['oob_url'] &&
        !attrs['file'] &&
        !(attrs['is_encrypted'] && attrs['plaintext']) &&
        !attrs['message'] &&
        !attrs['body'];
}

/**
 * We distinguish between UniView and MultiView instances.
 *
 * UniView means that only one chat is visible, even though there might be multiple ongoing chats.
 * MultiView means that multiple chats may be visible simultaneously.
 */
export function isUniView () {
    return ['mobile', 'fullscreen', 'embedded'].includes(settings_api.get("view_mode"));
}

export function shouldClearCache () {
    const { api } = _converse;
    return !_converse.config.get('trusted') ||
        api.settings.get('clear_cache_on_logout') ||
        _converse.isTestEnv();
}


export async function tearDown () {
    const { api } = _converse;
    await api.trigger('beforeTearDown', {'synchronous': true});
    window.removeEventListener('click', _converse.onUserActivity);
    window.removeEventListener('focus', _converse.onUserActivity);
    window.removeEventListener('keypress', _converse.onUserActivity);
    window.removeEventListener('mousemove', _converse.onUserActivity);
    window.removeEventListener(_converse.unloadevent, _converse.onUserActivity);
    window.clearInterval(_converse.everySecondTrigger);
    api.trigger('afterTearDown');
    return _converse;
}


export function clearSession () {
    _converse.session?.destroy();
    delete _converse.session;
    shouldClearCache() && _converse.api.user.settings.clear();
    /**
     * Synchronouse event triggered once the user session has been cleared,
     * for example when the user has logged out or when Converse has
     * disconnected for some other reason.
     * @event _converse#clearSession
     */
    return _converse.api.trigger('clearSession', {'synchronous': true});
}


/**
 * Given a message object, return its text with @ chars
 * inserted before the mentioned nicknames.
 */
export function prefixMentions (message) {
    let text = message.getMessageText();
    (message.get('references') || [])
        .sort((a, b) => b.begin - a.begin)
        .forEach(ref => {
            text = `${text.slice(0, ref.begin)}@${text.slice(ref.begin)}`
        });
    return text;
}

u.getJIDFromURI = function (jid) {
    return jid.startsWith('xmpp:') && jid.endsWith('?join')
        ? jid.replace(/^xmpp:/, '').replace(/\?join$/, '')
        : jid;
}

u.getLongestSubstring = function (string, candidates) {
    function reducer (accumulator, current_value) {
        if (string.startsWith(current_value)) {
            if (current_value.length > accumulator.length) {
                return current_value;
            } else {
                return accumulator;
            }
        } else {
            return accumulator;
        }
    }
    return candidates.reduce(reducer, '');
}

export function isValidJID (jid) {
    if (typeof jid === 'string') {
        return jid.split('@').filter(s => !!s).length === 2 && !jid.startsWith('@') && !jid.endsWith('@');
    }
    return false;
}

u.isValidMUCJID = function (jid) {
    return !jid.startsWith('@') && !jid.endsWith('@');
};

u.isSameBareJID = function (jid1, jid2) {
    if (typeof jid1 !== 'string' || typeof jid2 !== 'string') {
        return false;
    }
    return Strophe.getBareJidFromJid(jid1).toLowerCase() ===
            Strophe.getBareJidFromJid(jid2).toLowerCase();
};


u.isSameDomain = function (jid1, jid2) {
    if (typeof jid1 !== 'string' || typeof jid2 !== 'string') {
        return false;
    }
    return Strophe.getDomainFromJid(jid1).toLowerCase() ===
            Strophe.getDomainFromJid(jid2).toLowerCase();
};

u.isNewMessage = function (message) {
    /* Given a stanza, determine whether it's a new
     * message, i.e. not a MAM archived one.
     */
    if (message instanceof Element) {
        return !(
            sizzle(`result[xmlns="${Strophe.NS.MAM}"]`, message).length &&
            sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, message).length
        );
    } else if (message instanceof Model) {
        message = message.attributes;
    }
    return !(message['is_delayed'] && message['is_archived']);
};

u.shouldCreateMessage = function (attrs) {
    return attrs['retracted'] || // Retraction received *before* the message
        !isEmptyMessage(attrs);
}

u.shouldCreateGroupchatMessage = function (attrs) {
    return attrs.nick && (u.shouldCreateMessage(attrs) || attrs.is_tombstone);
}

u.isChatRoom = function (model) {
    return model && (model.get('type') === 'chatroom');
}

export function isErrorObject (o) {
    return o instanceof Error;
}

u.isErrorStanza = function (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return stanza.getAttribute('type') === 'error';
}

u.isForbiddenError = function (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return sizzle(`error[type="auth"] forbidden[xmlns="${Strophe.NS.STANZAS}"]`, stanza).length > 0;
}

u.isServiceUnavailableError = function (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return sizzle(`error[type="cancel"] service-unavailable[xmlns="${Strophe.NS.STANZAS}"]`, stanza).length > 0;
}

/**
 * Merge the second object into the first one.
 * @method u#merge
 * @param {Object} dst
 * @param {Object} src
 */
export function merge (dst, src) {
    for (const k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        if (k === "__proto__" || k === "constructor") continue;

        if (dst[k] instanceof Object) {
            merge(dst[k], src[k]);
        } else {
            dst[k] = src[k];
        }
    }
}


u.contains = function (attr, query) {
    const checker = (item, key) => item.get(key).toLowerCase().includes(query.toLowerCase());
    return function (item) {
        if (typeof attr === 'object') {
            return Object.keys(attr).reduce((acc, k) => acc || checker(item, k), false);
        } else if (typeof attr === 'string') {
            return checker(item, attr);
        } else {
            throw new TypeError('contains: wrong attribute type. Must be string or array.');
        }
    };
};

u.getAttribute = function (key, item) {
    return item.get(key);
};

u.contains.not = function (attr, query) {
    return function (item) {
        return !(u.contains(attr, query)(item));
    };
};

u.isPersistableModel = function (model) {
    return model.collection && model.collection.browserStorage;
};

u.getResolveablePromise = getOpenPromise;
u.getOpenPromise = getOpenPromise;

/**
 * Call the callback once all the events have been triggered
 * @private
 * @method u#onMultipleEvents
 * @param { Array } events: An array of objects, with keys `object` and
 *   `event`, representing the event name and the object it's triggered upon.
 * @param { Function } callback: The function to call once all events have
 *    been triggered.
 */
u.onMultipleEvents = function (events=[], callback) {
    let triggered = [];

    function handler (result) {
        triggered.push(result)
        if (events.length === triggered.length) {
            callback(triggered);
            triggered = [];
        }
    }
    events.forEach(e => e.object.on(e.event, handler));
};


export function safeSave (model, attributes, options) {
    if (u.isPersistableModel(model)) {
        model.save(attributes, options);
    } else {
        model.set(attributes, options);
    }
}


u.siblingIndex = function (el) {
    /* eslint-disable no-cond-assign */
    for (var i = 0; el = el.previousElementSibling; i++);
    return i;
};

/**
 * @param {Element} el
 * @param {string} name
 * @param {string} [type]
 * @param {boolean} [bubbles]
 * @param {boolean} [cancelable]
 */
function triggerEvent (el, name, type="Event", bubbles=true, cancelable=true) {
    const evt = document.createEvent(type);
    evt.initEvent(name, bubbles, cancelable);
    el.dispatchEvent(evt);
}

export function getRandomInt (max) {
    return (Math.random() * max) | 0;
}

/**
 * @param {string} [suffix]
 * @return {string}
 */
export function getUniqueId (suffix) {
    const uuid = crypto.randomUUID?.() ??
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = getRandomInt(16);
            const v = c === 'x' ? r : r & 0x3 | 0x8;
            return v.toString(16);
        });
    if (typeof(suffix) === "string" || typeof(suffix) === "number") {
        return uuid + ":" + suffix;
    } else {
        return uuid;
    }
}


/**
 * Clears the specified timeout and interval.
 * @method u#clearTimers
 * @param {ReturnType<typeof setTimeout>} timeout - Id if the timeout to clear.
 * @param {ReturnType<typeof setInterval>} interval - Id of the interval to clear.
 * @copyright Simen Bekkhus 2016
 * @license MIT
 */
function clearTimers(timeout, interval) {
    clearTimeout(timeout);
    clearInterval(interval);
}


/**
 * Creates a {@link Promise} that resolves if the passed in function returns a truthy value.
 * Rejects if it throws or does not return truthy within the given max_wait.
 * @method u#waitUntil
 * @param { Function } func - The function called every check_delay,
 *  and the result of which is the resolved value of the promise.
 * @param { number } [max_wait=300] - The time to wait before rejecting the promise.
 * @param { number } [check_delay=3] - The time to wait before each invocation of {func}.
 * @returns {Promise} A promise resolved with the value of func,
 *  or rejected with the exception thrown by it or it times out.
 * @copyright Simen Bekkhus 2016
 * @license MIT
 */
export function waitUntil (func, max_wait=300, check_delay=3) {
    // Run the function once without setting up any listeners in case it's already true
    try {
        const result = func();
        if (result) {
            return Promise.resolve(result);
        }
    } catch (e) {
        return Promise.reject(e);
    }

    const promise = getOpenPromise();
    const timeout_err = new Error();

    function checker () {
        try {
            const result = func();
            if (result) {
                clearTimers(max_wait_timeout, interval);
                promise.resolve(result);
            }
        } catch (e) {
            clearTimers(max_wait_timeout, interval);
            promise.reject(e);
        }
    }

    const interval = setInterval(checker, check_delay);

    function handler () {
        clearTimers(max_wait_timeout, interval);
        const err_msg = `Wait until promise timed out: \n\n${timeout_err.stack}`;
        console.trace();
        log.error(err_msg);
        promise.reject(new Error(err_msg));
    }

    const max_wait_timeout = setTimeout(handler, max_wait);

    return promise;
}


export function setUnloadEvent () {
    if ('onpagehide' in window) {
        // Pagehide gets thrown in more cases than unload. Specifically it
        // gets thrown when the page is cached and not just
        // closed/destroyed. It's the only viable event on mobile Safari.
        // https://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
        _converse.unloadevent = 'pagehide';
    } else if ('onbeforeunload' in window) {
        _converse.unloadevent = 'beforeunload';
    } else if ('onunload' in window) {
        _converse.unloadevent = 'unload';
    }
}


export function replacePromise (name) {
    const existing_promise = _converse.promises[name];
    if (!existing_promise) {
        throw new Error(`Tried to replace non-existing promise: ${name}`);
    }
    if (existing_promise.replace) {
        const promise = getOpenPromise();
        promise.replace = existing_promise.replace;
        _converse.promises[name] = promise;
    } else {
        log.debug(`Not replacing promise "${name}"`);
    }
}


const element = document.createElement('div');

export function decodeHTMLEntities (str) {
    if (str && typeof str === 'string') {
        element.innerHTML = DOMPurify.sanitize(str);
        str = element.textContent;
        element.textContent = '';
    }
    return str;
}


export function saveWindowState (ev) {
    // XXX: eventually we should be able to just use
    // document.visibilityState (when we drop support for older
    // browsers).
    let state;
    const event_map = {
        'focus': "visible",
        'focusin': "visible",
        'pageshow': "visible",
        'blur': "hidden",
        'focusout': "hidden",
        'pagehide': "hidden"
    };
    ev = ev || document.createEvent('Events');
    if (ev.type in event_map) {
        state = event_map[ev.type];
    } else {
        state = document.hidden ? "hidden" : "visible";
    }
    _converse.windowState = state;
    /**
     * Triggered when window state has changed.
     * Used to determine when a user left the page and when came back.
     * @event _converse#windowStateChanged
     * @type { object }
     * @property{ string } state - Either "hidden" or "visible"
     * @example _converse.api.listen.on('windowStateChanged', obj => { ... });
     */
    _converse.api.trigger('windowStateChanged', {state});
}


export default Object.assign({
    getCurrentWord,
    getOuterWidth,
    getRandomInt,
    isMentionBoundary,
    getUniqueId,
    isElement,
    isEmptyMessage,
    isErrorObject,
    isTagEqual,
    isValidJID,
    merge,
    placeCaretAtEnd,
    prefixMentions,
    queryChildren,
    replaceCurrentWord,
    safeSave,
    saveWindowState,
    shouldClearCache,
    stringToElement,
    stx,
    toStanza,
    triggerEvent,
    waitUntil, // TODO: remove. Only the API should be used
}, u);
