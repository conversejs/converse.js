/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the core utilities module.
 */
import log, { LEVELS } from '../log.js';
import { Model } from '@converse/skeletor';
import { toStanza } from 'strophe.js';
import { getOpenPromise } from '@converse/openpromise';
import { saveWindowState, shouldClearCache } from './session.js';
import { merge, isError, isFunction } from './object.js';
import { createStore, getDefaultStore } from './storage.js';
import { waitUntil } from './promise.js';
import { isValidJID, isValidMUCJID, isSameBareJID } from './jid.js';
import { isErrorStanza } from './stanza.js';
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
const u = {};


/**
 * @param {Event} [event]
 */
export function setLogLevelFromRoute (event) {
    if (location.hash.startsWith('#converse?loglevel=')) {
        event?.preventDefault();
        const level = location.hash.split('=').pop();
        if (Object.keys(LEVELS).includes(level)) {
            log.setLogLevel(/** @type {keyof LEVELS} */(level));
        } else {
            log.error(`Could not set loglevel of ${level}`);
        }
    }
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

function getLongestSubstring (string, candidates) {
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

function shouldCreateMessage (attrs) {
    return attrs['retracted'] || // Retraction received *before* the message
        !isEmptyMessage(attrs);
}

export function isErrorObject (o) {
    return o instanceof Error;
}

/**
 * Call the callback once all the events have been triggered
 * @param { Array } events: An array of objects, with keys `object` and
 *   `event`, representing the event name and the object it's triggered upon.
 * @param { Function } callback: The function to call once all events have
 *    been triggered.
 */
function onMultipleEvents (events=[], callback) {
    let triggered = [];

    function handler (result) {
        triggered.push(result)
        if (events.length === triggered.length) {
            callback(triggered);
            triggered = [];
        }
    }
    events.forEach(e => e.object.on(e.event, handler));
}

function isPersistableModel (model) {
    return model.collection && model.collection.browserStorage;
}

export function safeSave (model, attributes, options) {
    if (isPersistableModel(model)) {
        model.save(attributes, options);
    } else {
        model.set(attributes, options);
    }
}

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

export default Object.assign({
    arrayBufferToBase64,
    arrayBufferToHex,
    arrayBufferToString,
    base64ToArrayBuffer,
    checkFileTypes,
    createStore,
    getCurrentWord,
    getDefaultStore,
    getLongestSubstring,
    getOpenPromise,
    getOuterWidth,
    getRandomInt,
    getSelectValues,
    getURI,
    getUniqueId,
    isAllowedProtocolForMedia,
    isAudioURL,
    isElement,
    isEmptyMessage,
    isError,
    isErrorObject,
    isErrorStanza,
    isFunction,
    isGIFURL,
    isImageURL,
    isMentionBoundary,
    isSameBareJID,
    isTagEqual,
    isURLWithImageExtension,
    isValidJID,
    isValidMUCJID,
    isVideoURL,
    merge,
    onMultipleEvents,
    placeCaretAtEnd,
    prefixMentions,
    queryChildren,
    replaceCurrentWord,
    safeSave,
    saveWindowState,
    shouldClearCache,
    shouldCreateMessage,
    shouldRenderMediaFromURL,
    stringToArrayBuffer,
    stringToElement,
    toStanza,
    triggerEvent,
    webForm2xForm,
    waitUntil, // TODO: remove. Only the API should be used
}, u);
