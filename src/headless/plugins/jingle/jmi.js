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

const { Strophe, sizzle, stx } = converse.env;

// XEP-0353 requires every JMI message carry an XEP-0334 store hint so it reaches
// (via Carbons/MAM) all of both parties' devices despite having no body.
const store_hint = stx`<store xmlns="${Strophe.NS.HINTS}"/>`;

/**
 * @param {('audio'|'video')[]} media
 * @returns {import('strophe.js').Builder[]}
 */
function describe(media) {
    return media.map((m) => stx`<description xmlns="${Strophe.NS.JINGLE_RTP}" media="${m}"/>`);
}

/**
 * `<propose>` - invite a peer to a call (the caller's opening stanza).
 * @param {string} to - bare JID of the peer
 * @param {string} sid - Jingle session id
 * @param {('audio'|'video')[]} [media]
 */
export function buildPropose(to, sid, media = ['audio']) {
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
export function buildRinging(to, sid) {
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
export function buildProceed(to, sid) {
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
 */
export function buildReject(to, sid) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <reject xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}"/>
            ${store_hint}
        </message>`;
}

/**
 * `<retract>` - the caller cancels a call it hasn't yet had answered.
 * @param {string} to - bare JID of the callee
 * @param {string} sid
 */
export function buildRetract(to, sid) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <retract xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}"/>
            ${store_hint}
        </message>`;
}

/**
 * `<accept>` - addressed to our own bare JID so sibling devices stop ringing.
 * @param {string} to - our own bare JID
 * @param {string} sid
 */
export function buildAccept(to, sid) {
    return stx`
        <message id="${getUniqueId()}" to="${to}" type="chat" xmlns="jabber:client">
            <accept xmlns="${Strophe.NS.JINGLE_MESSAGE}" id="${sid}"/>
            ${store_hint}
        </message>`;
}

const JMI_ACTION_NAMES = Object.values(JMI_ACTIONS);

/**
 * Read a JMI child out of an inbound `<message>` stanza.
 * @param {Element} stanza
 * @returns {{ action: string, sid: string, from: string, to: string,
 *             media: ('audio'|'video')[] }|null} null when the stanza carries no JMI element
 */
export function parseJMI(stanza) {
    const el = sizzle(`> *[xmlns="${Strophe.NS.JINGLE_MESSAGE}"]`, stanza).pop();
    if (!el || !JMI_ACTION_NAMES.includes(el.tagName)) return null;
    const media = sizzle(`description[xmlns="${Strophe.NS.JINGLE_RTP}"]`, el).map(
        (d) => /** @type {'audio'|'video'} */ (d.getAttribute('media'))
    );
    return {
        action: el.tagName,
        sid: el.getAttribute('id'),
        from: stanza.getAttribute('from'),
        to: stanza.getAttribute('to'),
        media: media.length ? media : ['audio'],
    };
}
