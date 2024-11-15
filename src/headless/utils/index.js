/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the core utilities module.
 */
import { Model } from '@converse/skeletor';
import log, { LEVELS } from '../log.js';
import * as arraybuffer from './arraybuffer.js';
import * as color from './color.js';
import * as form from './form.js';
import * as html from './html.js';
import * as jid from './jid';
import * as object from './object.js';
import * as promise from './promise.js';
import * as session from './session.js';
import * as stanza from './stanza.js';
import * as storage from './storage.js';
import * as text from './text.js';
import * as url from './url.js';

/**
 * @typedef {Record<string, Function>} CommonUtils
 * @typedef {Record<'muc'|'mam', CommonUtils>} PluginUtils
 *
 * The utils object
 * @namespace u
 * @type {CommonUtils & PluginUtils}
 */
const u = {
    muc: null,
    mam: null,
};

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
    ...arraybuffer,
    ...color,
    ...form,
    ...html,
    ...jid,
    ...object,
    ...promise,
    ...session,
    ...stanza,
    ...storage,
    ...text,
    ...url,
    getRandomInt,
    getUniqueId,
    isEmptyMessage,
    isErrorObject,
    onMultipleEvents,
    prefixMentions,
    safeSave,
    shouldCreateMessage,
    triggerEvent,
}, u);
