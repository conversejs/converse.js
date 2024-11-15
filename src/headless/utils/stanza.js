import sizzle from "sizzle";
import { Strophe } from 'strophe.js';
import { isElement } from './html.js';
import { toStanza } from 'strophe.js';

export { toStanza };

/**
 * @param {Element} stanza
 * @returns {boolean}
 */
export function isErrorStanza (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return stanza.getAttribute('type') === 'error';
}

/**
 * @param {Element} stanza
 * @returns {boolean}
 */
export function isForbiddenError (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return sizzle(`error[type="auth"] forbidden[xmlns="${Strophe.NS.STANZAS}"]`, stanza).length > 0;
}

/**
 * @param {Element} stanza
 * @returns {boolean}
 */
export function isServiceUnavailableError (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return sizzle(`error[type="cancel"] service-unavailable[xmlns="${Strophe.NS.STANZAS}"]`, stanza).length > 0;
}

/**
 * Returns an object containing all attribute names and values for a particular element.
 * @param {Element} stanza
 * @returns {object}
 */
export function getAttributes (stanza) {
    return stanza.getAttributeNames().reduce((acc, name) => {
        acc[name] = Strophe.xmlunescape(stanza.getAttribute(name));
        return acc;
    }, {});
}
