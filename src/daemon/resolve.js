/**
 * Turns what a client gave for a conversation or contact into a bare JID. A
 * client may give a JID, or the name of a roster contact. The matching is
 * headless's (`api.contacts.resolve`); this module decides what a match, or
 * the lack of one, means for the request.
 * @module @converse/daemon/resolve
 */
import { converse } from '@converse/headless';
import { ERRORS, RPCError } from './protocol.js';

const { Strophe, u } = converse.env;

/**
 * @param {unknown} value
 * @param {string} name - The parameter's name, for the error message.
 * @returns {string} The bare JID
 */
export function parseJID(value, name) {
    const jid = typeof value === 'string' ? Strophe.getBareJidFromJid(value.trim()).toLowerCase() : '';
    if (!u.isValidJID(jid)) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `"${name}" must be a JID such as "juliet@capulet.lit".`);
    }
    return jid;
}

/**
 * A JID is taken as it is, whether or not it's on the roster. Anything else
 * is a name, and must match exactly one contact: a name matching none, or
 * several, is refused rather than guessed at.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {unknown} value
 * @param {string} name - The parameter's name, for the error message.
 * @returns {Promise<string>} The bare JID
 */
export async function resolveJID(_converse, value, name) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `"${name}" must be a JID, or the name of a contact.`);
    }
    if (u.isValidJID(text)) return parseJID(text, name);

    // Names are looked up in the roster, which only the server can supply.
    if (!_converse.api.connection.connected()) {
        throw new RPCError(
            ERRORS.NOT_CONNECTED,
            `"${text}" is a name, and names are looked up in your contacts, which needs the daemon to be ` +
                'connected. Check "converse-cli daemon status", then try again, or use the JID.',
        );
    }

    const matches = await _converse.api.contacts.resolve(text);
    if (matches.length === 1) return matches[0].jid.toLowerCase();
    if (matches.length === 0) {
        throw new RPCError(
            ERRORS.NOT_FOUND,
            `No contact is called "${text}". Check the spelling, or list your contacts with "converse-cli contacts".`,
        );
    }
    throw new RPCError(ERRORS.AMBIGUOUS, `"${text}" matches more than one contact. Use the JID of the one you mean.`, {
        candidates: matches.map(({ jid, name }) => (name ? `${name} <${jid}>` : jid)),
    });
}
