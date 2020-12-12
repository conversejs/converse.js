/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the core utilities module.
 */
import { Strophe } from 'strophe.js/src/strophe';
import { Model } from '@converse/skeletor/src/model.js';
import { compact, last, isElement, isObject } from "lodash-es";
import log from "@converse/headless/log";
import sizzle from "sizzle";

/**
 * The utils object
 * @namespace u
 */
const u = {};


u.isTagEqual = function (stanza, name) {
    if (stanza.nodeTree) {
        return u.isTagEqual(stanza.nodeTree, name);
    } else if (!(stanza instanceof Element)) {
        throw Error(
            "isTagEqual called with value which isn't "+
            "an element or Strophe.Builder instance");
    } else {
        return Strophe.isTagEqual(stanza, name);
    }
}

const parser = new DOMParser();
const parserErrorNS = parser.parseFromString('invalid', 'text/xml')
                            .getElementsByTagName("parsererror")[0].namespaceURI;

u.getJIDFromURI = function (jid) {
    return jid.startsWith('xmpp:') && jid.endsWith('?join')
        ? jid.replace(/^xmpp:/, '').replace(/\?join$/, '')
        : jid;
}

u.toStanza = function (string) {
    const node = parser.parseFromString(string, "text/xml");
    if (node.getElementsByTagNameNS(parserErrorNS, 'parsererror').length) {
        throw new Error(`Parser Error: ${string}`);
    }
    return node.firstElementChild;
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

u.prefixMentions = function (message) {
    /* Given a message object, return its text with @ chars
     * inserted before the mentioned nicknames.
     */
    let text = message.get('message');
    (message.get('references') || [])
        .sort((a, b) => b.begin - a.begin)
        .forEach(ref => {
            text = `${text.slice(0, ref.begin)}@${text.slice(ref.begin)}`
        });
    return text;
};

u.isValidJID = function (jid) {
    if (typeof jid === 'string') {
        return compact(jid.split('@')).length === 2 && !jid.startsWith('@') && !jid.endsWith('@');
    }
    return false;
};

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
        !u.isEmptyMessage(attrs);
}

u.shouldCreateGroupchatMessage = function (attrs) {
    return attrs.nick && (u.shouldCreateMessage(attrs) || attrs.is_tombstone);
}

u.isEmptyMessage = function (attrs) {
    if (attrs instanceof Model) {
        attrs = attrs.attributes;
    }
    return !attrs['oob_url'] &&
        !attrs['file'] &&
        !(attrs['is_encrypted'] && attrs['plaintext']) &&
        !attrs['message'];
};

//TODO: Remove
u.isOnlyChatStateNotification = function (msg) {
    if (msg instanceof Element) {
        // See XEP-0085 Chat State Notification
        return (msg.querySelector('body') === null) && (
                    (msg.querySelector('active') !== null) ||
                    (msg.querySelector('composing') !== null) ||
                    (msg.querySelector('inactive') !== null) ||
                    (msg.querySelector('paused') !== null) ||
                    (msg.querySelector('gone') !== null));
    }
    if (msg instanceof Model) {
        msg = msg.attributes;
    }
    return msg['chat_state'] && u.isEmptyMessage(msg);
};

u.isOnlyMessageDeliveryReceipt = function (msg) {
    if (msg instanceof Element) {
        // See XEP-0184 Message Delivery Receipts
        return (msg.querySelector('body') === null) &&
                    (msg.querySelector('received') !== null);
    }
    if (msg instanceof Model) {
        msg = msg.attributes;
    }
    return msg['received'] && u.isEmptyMessage(msg);
};

u.isChatRoom = function (model) {
    return model && (model.get('type') === 'chatroom');
}

u.isErrorObject = function (o) {
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
 * @private
 * @method u#merge
 * @param { Object } first
 * @param { Object } second
 */
u.merge = function merge (first, second) {
    for (const k in second) {
        if (isObject(first[k])) {
            merge(first[k], second[k]);
        } else {
            first[k] = second[k];
        }
    }
};

u.getOuterWidth = function (el, include_margin=false) {
    let width = el.offsetWidth;
    if (!include_margin) {
        return width;
    }
    const style = window.getComputedStyle(el);
    width += parseInt(style.marginLeft ? style.marginLeft : 0, 10) +
             parseInt(style.marginRight ? style.marginRight : 0, 10);
    return width;
};

/**
 * Converts an HTML string into a DOM element.
 * Expects that the HTML string has only one top-level element,
 * i.e. not multiple ones.
 * @private
 * @method u#stringToElement
 * @param { String } s - The HTML string
 */
u.stringToElement = function (s) {
    var div = document.createElement('div');
    div.innerHTML = s;
    return div.firstElementChild;
};

/**
 * Checks whether the DOM element matches the given selector.
 * @private
 * @method u#matchesSelector
 * @param { DOMElement } el - The DOM element
 * @param { String } selector - The selector
 */
u.matchesSelector = function (el, selector) {
    const match = (
        el.matches ||
        el.matchesSelector ||
        el.msMatchesSelector ||
        el.mozMatchesSelector ||
        el.webkitMatchesSelector ||
        el.oMatchesSelector
    );
    return match ? match.call(el, selector) : false;
};

/**
 * Returns a list of children of the DOM element that match the selector.
 * @private
 * @method u#queryChildren
 * @param { DOMElement } el - the DOM element
 * @param { String } selector - the selector they should be matched against
 */
u.queryChildren = function (el, selector) {
    return Array.from(el.childNodes).filter(el => u.matchesSelector(el, selector));
};

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

u.isOfType = function (type, item) {
    return item.get('type') == type;
};

u.isInstance = function (type, item) {
    return item instanceof type;
};

u.getAttribute = function (key, item) {
    return item.get(key);
};

u.contains.not = function (attr, query) {
    return function (item) {
        return !(u.contains(attr, query)(item));
    };
};

u.rootContains = function (root, el) {
    // The document element does not have the contains method in IE.
    if (root === document && !root.contains) {
        return document.head.contains(el) || document.body.contains(el);
    }
    return root.contains ? root.contains(el) : window.HTMLElement.prototype.contains.call(root, el);
};

u.createFragmentFromText = function (markup) {
    /* Returns a DocumentFragment containing DOM nodes based on the
     * passed-in markup text.
     */
    // http://stackoverflow.com/questions/9334645/create-node-from-markup-string
    var frag = document.createDocumentFragment(),
        tmp = document.createElement('body'), child;
    tmp.innerHTML = markup;
    // Append elements in a loop to a DocumentFragment, so that the
    // browser does not re-render the document for each node.
    while (child = tmp.firstChild) {  // eslint-disable-line no-cond-assign
        frag.appendChild(child);
    }
    return frag
};

u.isPersistableModel = function (model) {
    return model.collection && model.collection.browserStorage;
};

/**
 * Returns a promise object on which `resolve` or `reject` can be called.
 * @private
 * @method u#getResolveablePromise
 */
u.getResolveablePromise = function () {
    const wrapper = {
        isResolved: false,
        isPending: true,
        isRejected: false
    };
    const promise = new Promise((resolve, reject) => {
        wrapper.resolve = resolve;
        wrapper.reject = reject;
    })
    Object.assign(promise, wrapper);
    promise.then(
        function (v) {
            promise.isResolved = true;
            promise.isPending = false;
            promise.isRejected = false;
            return v;
        },
        function (e) {
            promise.isResolved = false;
            promise.isPending = false;
            promise.isRejected = true;
            throw (e);
        }
    );
    return promise;
};

u.interpolate = function (string, o) {
    return string.replace(/{{{([^{}]*)}}}/g,
        (a, b) => {
            var r = o[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        });
};

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

u.safeSave = function (model, attributes, options) {
    if (u.isPersistableModel(model)) {
        model.save(attributes, options);
    } else {
        model.set(attributes, options);
    }
};

u.siblingIndex = function (el) {
    /* eslint-disable no-cond-assign */
    for (var i = 0; el = el.previousElementSibling; i++);
    return i;
};

/**
 * Returns the current word being written in the input element
 * @method u#getCurrentWord
 * @param {HTMLElement} input - The HTMLElement in which text is being entered
 * @param {integer} [index] - An optional rightmost boundary index. If given, the text
 *  value of the input element will only be considered up until this index.
 * @param {string} [delineator] - An optional string delineator to
 *  differentiate between words.
 * @private
 */
u.getCurrentWord = function (input, index, delineator) {
    if (!index) {
        index = input.selectionEnd || undefined;
    }
    let [word] = input.value.slice(0, index).split(/\s/).slice(-1);
    if (delineator) {
        [word] = word.split(delineator).slice(-1);
    }
    return word;
};

u.isMentionBoundary = (s) => s !== '@' && RegExp(`(\\p{Z}|\\p{P})`, 'u').test(s);

u.replaceCurrentWord = function (input, new_value) {
    const caret = input.selectionEnd || undefined;
    const current_word = last(input.value.slice(0, caret).split(/\s/));
    const value = input.value;
    const mention_boundary = u.isMentionBoundary(current_word[0]) ? current_word[0] : '';
    input.value = value.slice(0, caret - current_word.length) + mention_boundary + `${new_value} ` + value.slice(caret);
    const selection_end = caret - current_word.length + new_value.length + 1;
    input.selectionEnd = mention_boundary ? selection_end + 1 : selection_end;
};

u.triggerEvent = function (el, name, type="Event", bubbles=true, cancelable=true) {
    const evt = document.createEvent(type);
    evt.initEvent(name, bubbles, cancelable);
    el.dispatchEvent(evt);
};

u.getSelectValues = function (select) {
    const result = [];
    const options = select && select.options;
    for (var i=0, iLen=options.length; i<iLen; i++) {
        const opt = options[i];
        if (opt.selected) {
            result.push(opt.value || opt.text);
        }
    }
    return result;
};

u.formatFingerprint = function (fp) {
    fp = fp.replace(/^05/, '');
    for (let i=1; i<8; i++) {
        const idx = i*8+i-1;
        fp = fp.slice(0, idx) + ' ' + fp.slice(idx);
    }
    return fp;
};

u.appendArrayBuffer = function (buffer1, buffer2) {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
};

u.arrayBufferToHex = function (ab) {
    // https://stackoverflow.com/questions/40031688/javascript-arraybuffer-to-hex#40031979
    return Array.prototype.map.call(new Uint8Array(ab), x => ('00' + x.toString(16)).slice(-2)).join('');
};

u.arrayBufferToString = function (ab) {
    return new TextDecoder("utf-8").decode(ab);
};

u.stringToArrayBuffer = function (string) {
    const bytes = new TextEncoder("utf-8").encode(string);
    return bytes.buffer;
};

u.arrayBufferToBase64 = function (ab) {
    return btoa((new Uint8Array(ab)).reduce((data, byte) => data + String.fromCharCode(byte), ''));
};

u.base64ToArrayBuffer = function (b64) {
    const binary_string =  window.atob(b64),
          len = binary_string.length,
          bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i)
    }
    return bytes.buffer
};

u.getRandomInt = function (max) {
    return Math.floor(Math.random() * Math.floor(max));
};

u.placeCaretAtEnd = function (textarea) {
    if (textarea !== document.activeElement) {
        textarea.focus();
    }
    // Double the length because Opera is inconsistent about whether a carriage return is one character or two.
    const len = textarea.value.length * 2;
    // Timeout seems to be required for Blink
    setTimeout(() => textarea.setSelectionRange(len, len), 1);
    // Scroll to the bottom, in case we're in a tall textarea
    // (Necessary for Firefox and Chrome)
    this.scrollTop = 999999;
};

u.getUniqueId = function (suffix) {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
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
 * @param {number} timeout - Id if the timeout to clear.
 * @param {number} interval - Id of the interval to clear.
 * @private
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
 * @param {Function} func - The function called every check_delay,
 *  and the result of which is the resolved value of the promise.
 * @param {number} [max_wait=300] - The time to wait before rejecting the promise.
 * @param {number} [check_delay=3] - The time to wait before each invocation of {func}.
 * @returns {Promise} A promise resolved with the value of func,
 *  or rejected with the exception thrown by it or it times out.
 * @copyright Simen Bekkhus 2016
 * @license MIT
 */
u.waitUntil = function (func, max_wait=300, check_delay=3) {
    // Run the function once without setting up any listeners in case it's already true
    try {
        const result = func();
        if (result) {
            return Promise.resolve(result);
        }
    } catch (e) {
        return Promise.reject(e);
    }

    const promise = u.getResolveablePromise();
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
};

export default u;
