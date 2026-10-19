/**
 * `<propose>` - invite a peer to a call (the caller's opening stanza).
 * @param {string} to - bare JID of the peer
 * @param {string} sid - Jingle session id
 * @param {import('./types').CallMedia[]} [media]
 */
export function createProposeStanza(to: string, sid: string, media?: import("./types").CallMedia[]): any;
/**
 * `<ringing>` - acknowledge a `<propose>`; the callee is alerting.
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 */
export function createRingingStanza(to: string, sid: string): any;
/**
 * `<proceed>` - the callee accepts; tells the caller to send a session-initiate.
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 */
export function createProceedStanza(to: string, sid: string): any;
/**
 * `<reject>` - decline a call (also sent when busy).
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 * @param {{ tie_break?: boolean }} [opts] - true when it only resolves a glare
 */
export function createRejectStanza(to: string, sid: string, { tie_break }?: {
    tie_break?: boolean;
}): any;
/**
 * `<retract>` - the caller cancels a call it hasn't yet had answered.
 * @param {string} to - bare JID of the callee
 * @param {string} sid
 * @param {{ tie_break?: boolean }} [opts] - true when it only resolves a glare
 */
export function createRetractStanza(to: string, sid: string, { tie_break }?: {
    tie_break?: boolean;
}): any;
/**
 * `<accept>` - addressed to our own bare JID so sibling devices stop ringing.
 * @param {string} to - our own bare JID
 * @param {string} sid
 */
export function createAcceptStanza(to: string, sid: string): any;
/**
 * `<finish>` - the call we took part in is over (XEP-0353 § 8). Both sides
 * send one, so that all their devices and archives learn how it ended.
 * @param {string} to - full JID of the peer that took part in the call
 * @param {string} sid
 * @param {string} reason - one of {@link import('./constants.js').ENDED_REASONS}
 */
export function createFinishStanza(to: string, sid: string, reason: string): any;
/**
 * Read a JMI child out of an inbound `<message>` stanza.
 * @param {Element} stanza
 * @returns {{ action: string, sid: string, from: string, to: string,
 *             media: import('./types').CallMedia[], stamp: string|null }|null} null when the stanza
 *             carries no JMI element. `stamp` is the `<delay>` timestamp, if it was held offline.
 */
export function parseJMI(stanza: Element): {
    action: string;
    sid: string;
    from: string;
    to: string;
    media: import("./types").CallMedia[];
    stamp: string | null;
} | null;
//# sourceMappingURL=jmi.d.ts.map