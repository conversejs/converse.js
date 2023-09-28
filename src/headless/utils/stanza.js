import sizzle from "sizzle";
import { Strophe } from 'strophe.js';
import { isElement } from './html.js';

export function isErrorStanza (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return stanza.getAttribute('type') === 'error';
}

export function isForbiddenError (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return sizzle(`error[type="auth"] forbidden[xmlns="${Strophe.NS.STANZAS}"]`, stanza).length > 0;
}

export function isServiceUnavailableError (stanza) {
    if (!isElement(stanza)) {
        return false;
    }
    return sizzle(`error[type="cancel"] service-unavailable[xmlns="${Strophe.NS.STANZAS}"]`, stanza).length > 0;
}
