import { Strophe } from 'strophe.js';
import _converse from '../shared/_converse';
import { settings_api } from '../shared/settings/api.js';

/**
 * @param {string|null} [jid]
 * @returns {boolean}
 */
export function isValidJID(jid) {
    if (!(typeof jid === 'string')) {
        return false;
    }

    const num_slashes = jid.split('/').length - 1;
    if (num_slashes > 1) {
        return false;
    }

    return jid.split('@').filter((s) => !!s).length === 2 && !jid.startsWith('@') && !jid.endsWith('@');
}

/**
 * @param {string} jid
 * @returns {boolean}
 */
export function isValidMUCJID(jid) {
    return !jid.startsWith('@') && !jid.endsWith('@');
}

/**
 * @param {string} jid1
 * @param {string} jid2
 * @returns {boolean}
 */
export function isSameBareJID(jid1, jid2) {
    if (typeof jid1 !== 'string' || typeof jid2 !== 'string') {
        return false;
    }
    return Strophe.getBareJidFromJid(jid1).toLowerCase() === Strophe.getBareJidFromJid(jid2).toLowerCase();
}

/**
 * @param {string} jid1
 * @param {string} jid2
 * @returns {boolean}
 */
export function isSameDomain(jid1, jid2) {
    if (typeof jid1 !== 'string' || typeof jid2 !== 'string') {
        return false;
    }
    return Strophe.getDomainFromJid(jid1).toLowerCase() === Strophe.getDomainFromJid(jid2).toLowerCase();
}

/**
 * @param {string} jid
 */
export function getJIDFromURI(jid) {
    return jid.startsWith('xmpp:') && jid.endsWith('?join') ? jid.replace(/^xmpp:/, '').replace(/\?join$/, '') : jid;
}

/**
 * @param {string} jid
 * @param {boolean} [include_resource=false]
 * @returns {boolean}
 */
export function isOwnJID(jid, include_resource = false) {
    if (include_resource) {
        return jid === _converse.session.get('full_jid');
    }
    return Strophe.getBareJidFromJid(jid) === _converse.session.get('bare_jid');
}

/**
 * Appends locked_domain or default_domain to a JID if configured.
 * When locked_domain is set, it will:
 * - Strip the locked_domain if already present in the input
 * - Escape the username part using Strophe.escapeNode()
 * - Append the locked_domain
 * When default_domain is set and the input is not already a valid JID:
 * - Escape the username part using Strophe.escapeNode()
 * - Append the default_domain
 * @param {string} jid - The JID or username to process
 * @returns {string} The full JID with domain appended if applicable
 */
export function maybeAppendDomain(jid) {
    const locked_domain = settings_api.get('locked_domain');
    const default_domain = settings_api.get('default_domain');

    if (locked_domain) {
        const last_part = '@' + locked_domain;
        if (jid.endsWith(last_part)) {
            jid = jid.substring(0, jid.length - last_part.length);
        }
        jid = Strophe.escapeNode(jid) + last_part;
    } else if (default_domain && !isValidJID(jid)) {
        jid = Strophe.escapeNode(jid) + '@' + default_domain;
    }

    return jid;
}

