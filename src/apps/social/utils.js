/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { converse } from '@converse/headless';

const { Strophe } = converse.env;

// Localparts longer than this are elided for display.
const MAX_LOCALPART_LENGTH = 24;

// How much of an elided localpart survives, head and tail. Enough of the head
// to tell two JIDs apart at a glance, plus the tail.
const HEAD_LENGTH = 10;
const TAIL_LENGTH = 6;

/**
 * A JID shortened for display: an over-long localpart is elided in the middle,
 * keeping its head, its tail and the domain, which is what says *where* an author
 * lives. Short JIDs, which is to say every human-chosen one, are returned untouched.
 *
 * This should only be used for display purposes.
 * @param {string} [jid]
 * @returns {string}
 */
export function shortenJID(jid) {
    if (!jid) return '';

    const local = Strophe.getNodeFromJid(jid);
    if (!local || local.length <= MAX_LOCALPART_LENGTH) return jid;

    const domain = Strophe.getDomainFromJid(jid);
    const short = `${local.slice(0, HEAD_LENGTH)}…${local.slice(-TAIL_LENGTH)}`;
    return domain ? `${short}@${domain}` : short;
}

/**
 * Whether a post's display name carries no more information than its author's
 * JID, which is the case for an author that has no human name to show.
 *
 * A name that is only the JID's localpart counts as one, but *only* for a
 * localpart long enough to be machine-generated.
 * @param {string} [name]
 * @param {string} [jid]
 * @returns {boolean}
 */
export function isJIDName(name, jid) {
    if (!name || !jid) return false;
    if (name === jid) return true;

    const local = Strophe.getNodeFromJid(jid);
    return !!local && name === local && local.length > MAX_LOCALPART_LENGTH;
}
