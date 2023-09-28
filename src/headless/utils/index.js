/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the core utilities module.
 */
import DOMPurify from 'dompurify';
import sizzle from "sizzle";
import { Model } from '@converse/skeletor/src/model.js';
import { Strophe, toStanza } from 'strophe.js';
import { getOpenPromise } from '@converse/openpromise';
import { saveWindowState, shouldClearCache } from './session.js';
import { merge, isError, isFunction } from './object.js';
import { createStore, getDefaultStore } from './storage.js';
import { waitUntil } from './promise.js';
import { isValidJID, isValidMUCJID, isSameBareJID } from './jid.js';
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
    isError,
    isFunction,
    isGIFURL,
    isImageURL,
    isURLWithImageExtension,
    isVideoURL,
    shouldRenderMediaFromURL,
    stringToArrayBuffer,
    webForm2xForm,
};


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

u.getAttribute = function (key, item) {
    return item.get(key);
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


const element = document.createElement('div');

export function decodeHTMLEntities (str) {
    if (str && typeof str === 'string') {
        element.innerHTML = DOMPurify.sanitize(str);
        str = element.textContent;
        element.textContent = '';
    }
    return str;
}

export default Object.assign({
    createStore,
    getCurrentWord,
    getDefaultStore,
    getOuterWidth,
    getRandomInt,
    getUniqueId,
    isElement,
    isEmptyMessage,
    isErrorObject,
    isMentionBoundary,
    isSameBareJID,
    isTagEqual,
    isValidJID,
    isValidMUCJID,
    merge,
    placeCaretAtEnd,
    prefixMentions,
    queryChildren,
    replaceCurrentWord,
    safeSave,
    saveWindowState,
    shouldClearCache,
    stringToElement,
    toStanza,
    triggerEvent,
    waitUntil, // TODO: remove. Only the API should be used
}, u);
