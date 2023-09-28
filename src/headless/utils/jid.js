import { Strophe } from 'strophe.js';

export function isValidJID (jid) {
    if (typeof jid === 'string') {
        return jid.split('@').filter((s) => !!s).length === 2 && !jid.startsWith('@') && !jid.endsWith('@');
    }
    return false;
}

export function isValidMUCJID (jid) {
    return !jid.startsWith('@') && !jid.endsWith('@');
}

export function isSameBareJID (jid1, jid2) {
    if (typeof jid1 !== 'string' || typeof jid2 !== 'string') {
        return false;
    }
    return Strophe.getBareJidFromJid(jid1).toLowerCase() === Strophe.getBareJidFromJid(jid2).toLowerCase();
}

export function isSameDomain (jid1, jid2) {
    if (typeof jid1 !== 'string' || typeof jid2 !== 'string') {
        return false;
    }
    return Strophe.getDomainFromJid(jid1).toLowerCase() === Strophe.getDomainFromJid(jid2).toLowerCase();
}

export function getJIDFromURI (jid) {
    return jid.startsWith('xmpp:') && jid.endsWith('?join')
        ? jid.replace(/^xmpp:/, '').replace(/\?join$/, '')
        : jid;
}
