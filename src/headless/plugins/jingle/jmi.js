/**
 * XEP-0353 Jingle Message Initiation - stanza builders and parser.
 *
 * Pure and stateless: the builders return `stx` message trees, `parseJMI` reads
 * one back. JMI messages are `type="chat"`
 * so they carbon-copy to the sender's other devices (multi-device awareness).
 */
import converse from '../../shared/api/public.js';
import { getUniqueId } from '../../utils/index.js';
import { JMI_ACTIONS } from './constants.js';
import { reasonCondition } from './reasons.js';

const { Strophe, sizzle, stx } = converse.env;

// XEP-0353 requires every JMI message carry an XEP-0334 store hint so it reaches
// (via Carbons/MAM) all of both parties' devices despite having no body.
const store_hint = stx`<store xmlns="${Strophe.NS.HINTS}"/>`;

/**
 * @param {import('./types').CallMedia[]} media
 * @returns {import('strophe.js').Builder[]}
 */
function describe(media) {
    return media.map((m) => stx`<description xmlns="${Strophe.NS.JINGLE_RTP}" media="${m}"/>`);
}

/**
 * Says a `<reject>` or `<retract>` only resolves a glare (XEP-0353 § 9.1).
 * @returns {import('strophe.js').Builder[]}
 */
function tieBreak() {
    return [
        stx`<reason xmlns="${Strophe.NS.JINGLE}"><expired/><text>Tie-Break</text></reason>`,
        stx`<tie-break xmlns="${Strophe.NS.JINGLE_MESSAGE}"/>`,
    ];
}

/**
 * `<propose>` - invite a peer to a call (the caller's opening stanza).
 * @param {string} to - bare JID of the peer
 * @param {string} sid - Jingle session id
 * @param {import('./types').CallMedia[]} [media]
 */
export function createProposeStanza(to, sid, media = ['audio']) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <propose xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}">
                ${describe(media)}
            </propose>
            ${store_hint}
        </message>`;
}

/**
 * `<ringing>` - acknowledge a `<propose>`; the callee is alerting.
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 */
export function createRingingStanza(to, sid) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <ringing xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}"/>
            ${store_hint}
        </message>`;
}

/**
 * `<proceed>` - the callee accepts; tells the caller to send a session-initiate.
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 */
export function createProceedStanza(to, sid) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <proceed xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}"/>
            ${store_hint}
        </message>`;
}

/**
 * `<reject>` - decline a call (also sent when busy).
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 * @param {{ tie_break?: boolean }} [opts] - true when it only resolves a glare
 */
export function createRejectStanza(to, sid, { tie_break = false } = {}) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <reject xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}">${tie_break ? tieBreak() : ''}</reject>
            ${store_hint}
        </message>`;
}

/**
 * `<retract>` - the caller cancels a call it hasn't yet had answered.
 * @param {string} to - bare JID of the callee
 * @param {string} sid
 * @param {{ tie_break?: boolean }} [opts] - true when it only resolves a glare
 */
export function createRetractStanza(to, sid, { tie_break = false } = {}) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <retract xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}">${tie_break ? tieBreak() : ''}</retract>
            ${store_hint}
        </message>`;
}

/**
 * `<accept>` - addressed to our own bare JID so sibling devices stop ringing.
 * @param {string} to - our own bare JID
 * @param {string} sid
 */
export function createAcceptStanza(to, sid) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <accept xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}"/>
            ${store_hint}
        </message>`;
}

/**
 * `<finish>` - the call we took part in is over (XEP-0353 § 8). Both sides
 * send one, so that all their devices and archives learn how it ended.
 * @param {string} to - full JID of the peer that took part in the call
 * @param {string} sid
 * @param {string} reason - one of {@link import('./constants.js').ENDED_REASONS}
 */
export function createFinishStanza(to, sid, reason) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <finish xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}">
                <reason xmlns="${Strophe.NS.JINGLE}">${reasonCondition(reason)}</reason>
            </finish>
            ${store_hint}
        </message>`;
}

const JMI_ACTION_NAMES = Object.values(JMI_ACTIONS);
const SUPPORTED_MEDIA = ['audio'];

/**
 * Read a JMI child out of an inbound `<message>` stanza.
 * @param {Element} stanza
 * @returns {{ action: string, sid: string, from: string, to: string,
 *             media: import('./types').CallMedia[], stamp: string|null }|null} null when the stanza
 *             carries no JMI element. `stamp` is the `<delay>` timestamp, if it was held offline.
 */
export function parseJMI(stanza) {
    const el = sizzle(`> *[xmlns="${Strophe.NS.JINGLE_MESSAGE}"]`, stanza).pop();
    if (!el || !JMI_ACTION_NAMES.includes(el.tagName)) return null;
    const descriptions = sizzle(`description[xmlns="${Strophe.NS.JINGLE_RTP}"]`, el);
    // The media decide which devices we capture, so only take up what we support.
    const media = descriptions
        .map((d) => /** @type {import('./types').CallMedia} */ (d.getAttribute('media')))
        .filter((m) => SUPPORTED_MEDIA.includes(m));
    const stamp = sizzle(`> delay[xmlns="${Strophe.NS.DELAY}"]`, stanza).pop()?.getAttribute('stamp');
    return {
        action: el.tagName,
        sid: el.getAttribute('id'),
        from: stanza.getAttribute('from'),
        to: stanza.getAttribute('to'),
        media: descriptions.length ? media : ['audio'],
        stamp: stamp ?? null,
    };
}
