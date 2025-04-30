import { Strophe } from 'strophe.js';
import _converse from "../shared/_converse";

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
