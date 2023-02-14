import log from '../log.js';
import { Strophe } from 'strophe.js/src/strophe';

const PARSE_ERROR_NS = 'http://www.w3.org/1999/xhtml';

export function toStanza (string, throwErrorIfInvalidNS) {
    const doc = Strophe.xmlHtmlNode(string);

    if (doc.getElementsByTagNameNS(PARSE_ERROR_NS, 'parsererror').length) {
        throw new Error(`Parser Error: ${string}`);
    }

    const node = doc.firstElementChild;

    if (
        ['message', 'iq', 'presence'].includes(node.nodeName.toLowerCase()) &&
        node.namespaceURI !== 'jabber:client' &&
        node.namespaceURI !== 'jabber:server'
    ) {
        const err_msg = `Invalid namespaceURI ${node.namespaceURI}`;
        log.error(err_msg);
        if (throwErrorIfInvalidNS) throw new Error(err_msg);
    }
    return node;
}

/**
 * A Stanza represents a XML element used in XMPP (commonly referred to as
 * stanzas).
 */
class Stanza {

    constructor (strings, values) {
        this.strings = strings;
        this.values = values;
    }

    toString () {
        this.string = this.string ||
             this.strings.reduce((acc, str) => {
                const idx = this.strings.indexOf(str);
                const value = this.values.length > idx ? this.values[idx].toString() : '';
                return acc + str + value;
            }, '');
        return this.string;
    }

    tree () {
        this.node = this.node ?? toStanza(this.toString(), true);
        return this.node;
    }
}

/**
 * Tagged template literal function which generates {@link Stanza } objects
 *
 * Similar to the `html` function, from Lit.
 *
 * @example stx`<presence type="${type}"><show>${show}</show></presence>`
 */
export function stx (strings, ...values) {
    return new Stanza(strings, values);
}
