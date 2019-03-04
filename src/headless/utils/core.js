// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// This is the utilities module.
//
// Copyright (c) 2013-2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global escape, Uint8Array */

import Backbone from "backbone";
import Promise from "es6-promise/dist/es6-promise.auto";
import { Strophe } from "strophe.js";
import _ from "../lodash.noconflict";
import sizzle from "sizzle";

const u = {};

u.toStanza = function (string) {
    return Strophe.xmlHtmlNode(string).firstElementChild;
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
    return _.compact(jid.split('@')).length === 2 && !jid.startsWith('@') && !jid.endsWith('@');
};

u.isValidMUCJID = function (jid) {
    return !jid.startsWith('@') && !jid.endsWith('@');
};

u.isSameBareJID = function (jid1, jid2) {
    return Strophe.getBareJidFromJid(jid1).toLowerCase() ===
            Strophe.getBareJidFromJid(jid2).toLowerCase();
};

u.getMostRecentMessage = function (model) {
    const messages = model.messages.filter('message');
    return messages[messages.length-1];
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
    } else if (message instanceof Backbone.Model) {
        message = message.attributes;
    }
    return !(message['is_delayed'] && message['is_archived']);
};

u.isEmptyMessage = function (attrs) {
    if (attrs instanceof Backbone.Model) {
        attrs = attrs.attributes;
    }
    return !attrs['oob_url'] &&
        !attrs['file'] &&
        !(attrs['is_encrypted'] && attrs['plaintext']) &&
        !attrs['message'];
};

u.isOnlyChatStateNotification = function (attrs) {
    if (attrs instanceof Backbone.Model) {
        attrs = attrs.attributes;
    }
    return attrs['chat_state'] && u.isEmptyMessage(attrs);
};

u.isHeadlineMessage = function (_converse, message) {
    const from_jid = message.getAttribute('from');
    if (message.getAttribute('type') === 'headline') {
        return true;
    }
    const chatbox = _converse.chatboxes.get(Strophe.getBareJidFromJid(from_jid));
    if (chatbox && chatbox.get('type') === _converse.CHATROOMS_TYPE) {
        return false;
    }
    if (message.getAttribute('type') !== 'error' &&
            !_.isNil(from_jid) &&
            !_.includes(from_jid, '@')) {
        // Some servers (I'm looking at you Prosody) don't set the message
        // type to "headline" when sending server messages. For now we
        // check if an @ signal is included, and if not, we assume it's
        // a headline message.
        return true;
    }
    return false;
};

u.merge = function merge (first, second) {
    /* Merge the second object into the first one.
     */
    for (var k in second) {
        if (_.isObject(first[k])) {
            merge(first[k], second[k]);
        } else {
            first[k] = second[k];
        }
    }
};

u.applyUserSettings = function applyUserSettings (context, settings, user_settings) {
    /* Configuration settings might be nested objects. We only want to
     * add settings which are whitelisted.
     */
    for (var k in settings) {
        if (_.isUndefined(user_settings[k])) {
            continue;
        }
        if (_.isObject(settings[k]) && !_.isArray(settings[k])) {
            applyUserSettings(context[k], settings[k], user_settings[k]);
        } else {
            context[k] = user_settings[k];
        }
    }
};

u.stringToNode = function (s) {
    /* Converts an HTML string into a DOM Node.
     * Expects that the HTML string has only one top-level element,
     * i.e. not multiple ones.
     *
     * Parameters:
     *      (String) s - The HTML string
     */
    var div = document.createElement('div');
    div.innerHTML = s;
    return div.firstElementChild;
};

u.getOuterWidth = function (el, include_margin=false) {
    var width = el.offsetWidth;
    if (!include_margin) {
        return width;
    }
    var style = window.getComputedStyle(el);
    width += parseInt(style.marginLeft, 10) + parseInt(style.marginRight, 10);
    return width;
};

u.stringToElement = function (s) {
    /* Converts an HTML string into a DOM element.
     * Expects that the HTML string has only one top-level element,
     * i.e. not multiple ones.
     *
     * Parameters:
     *      (String) s - The HTML string
     */
    var div = document.createElement('div');
    div.innerHTML = s;
    return div.firstElementChild;
};

u.matchesSelector = function (el, selector) {
    /* Checks whether the DOM element matches the given selector.
     *
     * Parameters:
     *      (DOMElement) el - The DOM element
     *      (String) selector - The selector
     */
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

u.queryChildren = function (el, selector) {
    /* Returns a list of children of the DOM element that match the
     * selector.
     *
     *  Parameters:
     *      (DOMElement) el - the DOM element
     *      (String) selector - the selector they should be matched
     *          against.
     */
    return _.filter(el.childNodes, _.partial(u.matchesSelector, _, selector));
};

u.contains = function (attr, query) {
    return function (item) {
        if (typeof attr === 'object') {
            var value = false;
            _.forEach(attr, function (a) {
                value = value || _.includes(item.get(a).toLowerCase(), query.toLowerCase());
            });
            return value;
        } else if (typeof attr === 'string') {
            return _.includes(item.get(attr).toLowerCase(), query.toLowerCase());
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

u.getResolveablePromise = function () {
    /* Returns a promise object on which `resolve` or `reject` can be
     * called.
     */
    const wrapper = {};
    const promise = new Promise((resolve, reject) => {
        wrapper.resolve = resolve;
        wrapper.reject = reject;
    })
    _.assign(promise, wrapper);
    return promise;
};

u.interpolate = function (string, o) {
    return string.replace(/{{{([^{}]*)}}}/g,
        (a, b) => {
            var r = o[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        });
};

u.onMultipleEvents = function (events=[], callback) {
    /* Call the callback once all the events have been triggered
     *
     * Parameters:
     *  (Array) events: An array of objects, with keys `object` and
     *      `event`, representing the event name and the object it's
     *      triggered upon.
     *  (Function) callback: The function to call once all events have
     *      been triggered.
     */
    let triggered = [];

    function handler (result) {
        triggered.push(result)
        if (events.length === triggered.length) {
            callback(triggered);
            triggered = [];
        }
    }
    _.each(events, (map) => map.object.on(map.event, handler));
};

u.safeSave = function (model, attributes) {
    if (u.isPersistableModel(model)) {
        model.save(attributes);
    } else {
        model.set(attributes);
    }
};

u.siblingIndex = function (el) {
    /* eslint-disable no-cond-assign */
    for (var i = 0; el = el.previousElementSibling; i++);
    return i;
};

u.getCurrentWord = function (input, index) {
    if (!index) {
        index = input.selectionEnd || undefined;
    }
    return _.last(input.value.slice(0, index).split(' '));
};

u.replaceCurrentWord = function (input, new_value) {
    const cursor = input.selectionEnd || undefined,
          current_word = _.last(input.value.slice(0, cursor).split(' ')),
          value = input.value;
    input.value = value.slice(0, cursor - current_word.length) + `${new_value} ` + value.slice(cursor);
    input.selectionEnd = cursor - current_word.length + new_value.length + 1;
};

u.triggerEvent = function (el, name, type="Event", bubbles=true, cancelable=true) {
    const evt = document.createEvent(type);
    evt.initEvent(name, bubbles, cancelable);
    el.dispatchEvent(evt);
};

u.geoUriToHttp = function(text, geouri_replacement) {
    const regex = /geo:([\-0-9.]+),([\-0-9.]+)(?:,([\-0-9.]+))?(?:\?(.*))?/g;
    return text.replace(regex, geouri_replacement);
};

u.httpToGeoUri = function(text, _converse) {
    const replacement = 'geo:$1,$2';
    return text.replace(_converse.geouri_regex, replacement);
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
    const arr = [];
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

u.putCurserAtEnd = function (textarea) {
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

u.getUniqueId = function () {
    return 'xxxxxxxx-xxxx'.replace(/[x]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
};

export default u;
