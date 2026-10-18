/**
 * @param {string} sdp
 * @returns {SessionDescription}
 */
export function parseSDP(sdp: string): SessionDescription;
/**
 * @param {SessionDescription} sdp
 * @returns {string}
 */
export function writeSDP(sdp: SessionDescription): string;
/**
 * @param {SdpDirection} direction
 * @param {boolean} is_initiator
 * @returns {JingleSenders}
 */
export function directionToSenders(direction: SdpDirection, is_initiator: boolean): JingleSenders;
/**
 * @param {JingleSenders} senders
 * @param {boolean} is_initiator
 * @returns {SdpDirection}
 */
export function sendersToDirection(senders: JingleSenders, is_initiator: boolean): SdpDirection;
/**
 * ICE-UDP (XEP-0176) carries UDP candidates only; a TCP one would lose its
 * `tcptype` on the way.
 * @param {SdpCandidate} candidate
 * @returns {boolean}
 */
export function isUdpCandidate(candidate: SdpCandidate): boolean;
/**
 * The ICE credentials of an m-line. Some browsers put them at the session
 * level only, once for all m-lines.
 * @param {MediaDescription} media
 * @param {SessionDescription} [session]
 * @returns {{ ufrag: string, pwd: string }}
 */
export function iceCredentials(media: MediaDescription, session?: SessionDescription): {
    ufrag: string;
    pwd: string;
};
/**
 * @param {SdpCandidate} candidate
 * @returns {Element}
 */
export function candidateToElement(candidate: SdpCandidate): Element;
/**
 * Parse a browser ICE candidate line ("candidate:...") into an {@link SdpCandidate}.
 * @param {string} line
 * @returns {SdpCandidate}
 */
export function candidateFromLine(line: string): SdpCandidate;
/**
 * Format an {@link SdpCandidate} back into a browser ICE candidate line.
 * @param {SdpCandidate} c
 * @returns {string}
 */
export function candidateToLine(c: SdpCandidate): string;
/**
 * @param {Element} el
 * @returns {SdpCandidate}
 */
export function elementToCandidate(el: Element): SdpCandidate;
/**
 * Convert a parsed SDP offer/answer into a Jingle stanza payload.
 * @param {SessionDescription} sdp
 * @param {JingleConversionOptions} options
 * @returns {Element}
 */
export function sdpToJingle(sdp: SessionDescription, options: JingleConversionOptions): Element;
/**
 * Build a Jingle transport-info `<jingle>` carrying a single trickled candidate.
 * @param {SdpCandidate} candidate
 * @param {{ sid: string, mid: string, ufrag: string, pwd: string,
 *           initiator?: string, responder?: string, creator?: 'initiator'|'responder' }} options
 * @returns {Element}
 */
export function buildTransportInfo(candidate: SdpCandidate, options: {
    sid: string;
    mid: string;
    ufrag: string;
    pwd: string;
    initiator?: string;
    responder?: string;
    creator?: "initiator" | "responder";
}): Element;
/**
 * Build a transport-info `<jingle>` that offers an ICE restart (XEP-0176): each
 * content's new credentials, and no candidates.
 * @param {SessionDescription} sdp - our restart offer
 * @param {{ sid: string, initiator?: string, responder?: string }} options
 * @returns {Element}
 */
export function buildIceRestart(sdp: SessionDescription, options: {
    sid: string;
    initiator?: string;
    responder?: string;
}): Element;
/**
 * The ICE credentials a transport-info carries, by content name.
 * @param {Element} jingle
 * @returns {Map<string, { ufrag: string, pwd: string }>}
 */
export function transportCredentials(jingle: Element): Map<string, {
    ufrag: string;
    pwd: string;
}>;
/**
 * The peer's description again, with the new ICE credentials of a restart.
 * @param {string} sdp - the peer's current description
 * @param {Map<string, { ufrag: string, pwd: string }>} credentials - by content name; a
 *      content left out takes the first ones, as its transport is bundled
 * @param {string} setup - the DTLS role: `actpass` in an offer, else the role the peer took
 * @returns {string}
 */
export function restartedDescription(sdp: string, credentials: Map<string, {
    ufrag: string;
    pwd: string;
}>, setup: string): string;
/**
 * Convert a received Jingle stanza payload into a parsed SDP structure that can
 * be serialised with sdp-transform's `write()`.
 * @param {Element} jingle
 * @param {JingleConversionOptions} options
 * @returns {SessionDescription}
 */
export function jingleToSDP(jingle: Element, options: JingleConversionOptions): SessionDescription;
export type SessionDescription = import("./types").SessionDescription;
export type MediaDescription = import("./types").MediaDescription;
export type JingleSenders = import("./types").JingleSenders;
export type SdpDirection = import("./types").SdpDirection;
export type SdpCandidate = import("./types").SdpCandidate;
export type JingleConversionOptions = import("./types").JingleConversionOptions;
//# sourceMappingURL=sdp.d.ts.map