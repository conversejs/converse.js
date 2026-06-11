/**
 * `<propose>` — invite a peer to a call (the caller's opening stanza).
 * @param {string} to - bare JID of the peer
 * @param {string} sid - Jingle session id
 * @param {('audio'|'video')[]} [media]
 */
export function buildPropose(to: string, sid: string, media?: ("audio" | "video")[]): any;
/**
 * `<ringing>` — acknowledge a `<propose>`; the callee is alerting.
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 */
export function buildRinging(to: string, sid: string): any;
/**
 * `<proceed>` — the callee accepts; tells the caller to send a session-initiate.
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 */
export function buildProceed(to: string, sid: string): any;
/**
 * `<reject>` — decline a call (also sent when busy).
 * @param {string} to - bare JID of the caller
 * @param {string} sid
 */
export function buildReject(to: string, sid: string): any;
/**
 * `<retract>` — the caller cancels a call it hasn't yet had answered.
 * @param {string} to - bare JID of the callee
 * @param {string} sid
 */
export function buildRetract(to: string, sid: string): any;
/**
 * `<accept>` — addressed to our own bare JID so sibling devices stop ringing.
 * @param {string} to - our own bare JID
 * @param {string} sid
 */
export function buildAccept(to: string, sid: string): any;
/**
 * Read a JMI child out of an inbound `<message>` stanza.
 * @param {Element} stanza
 * @returns {{ action: string, sid: string, from: string, to: string,
 *             media: ('audio'|'video')[] }|null} null when the stanza carries no JMI element
 */
export function parseJMI(stanza: Element): {
    action: string;
    sid: string;
    from: string;
    to: string;
    media: ("audio" | "video")[];
} | null;
//# sourceMappingURL=jmi.d.ts.map