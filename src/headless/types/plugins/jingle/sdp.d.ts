/**
 * @param {string} sdp
 * @returns {import('./types').SessionDescription}
 */
export function parseSDP(sdp: string): import("./types").SessionDescription;
/**
 * @param {import('./types').SessionDescription} sdp
 * @returns {string}
 */
export function writeSDP(sdp: import("./types").SessionDescription): string;
/**
 * @param {import('./types').SdpDirection} direction
 * @param {boolean} is_initiator
 * @returns {import('./types').JingleSenders}
 */
export function directionToSenders(direction: import("./types").SdpDirection, is_initiator: boolean): import("./types").JingleSenders;
/**
 * @param {import('./types').JingleSenders} senders
 * @param {boolean} is_initiator
 * @returns {import('./types').SdpDirection}
 */
export function sendersToDirection(senders: import("./types").JingleSenders, is_initiator: boolean): import("./types").SdpDirection;
/**
 * ICE-UDP (XEP-0176) carries UDP candidates only; a TCP one would lose its
 * `tcptype` on the way.
 * @param {import('./types').SdpCandidate} candidate
 * @returns {boolean}
 */
export function isUdpCandidate(candidate: import("./types").SdpCandidate): boolean;
/**
 * The ICE credentials of an m-line. Some browsers put them at the session
 * level only, once for all m-lines.
 * @param {import('./types').MediaDescription} media
 * @param {import('./types').SessionDescription} [session]
 * @returns {{ ufrag: string, pwd: string }}
 */
export function iceCredentials(media: import("./types").MediaDescription, session?: import("./types").SessionDescription): {
    ufrag: string;
    pwd: string;
};
/**
 * @param {import('./types').SdpCandidate} candidate
 * @returns {Element}
 */
export function candidateToElement(candidate: import("./types").SdpCandidate): Element;
/**
 * Parse a browser ICE candidate line ("candidate:...") into an SDP candidate.
 * @param {string} line
 * @returns {import('./types').SdpCandidate}
 */
export function candidateFromLine(line: string): import("./types").SdpCandidate;
/**
 * Format an SDP candidate back into a browser ICE candidate line.
 * @param {import('./types').SdpCandidate} c
 * @returns {string}
 */
export function candidateToLine(c: import("./types").SdpCandidate): string;
/**
 * @param {Element} el
 * @returns {import('./types').SdpCandidate}
 */
export function elementToCandidate(el: Element): import("./types").SdpCandidate;
/**
 * Convert a parsed SDP offer/answer into a Jingle stanza payload.
 * @param {import('./types').SessionDescription} sdp
 * @param {import('./types').JingleConversionOptions} options
 * @returns {Element}
 */
export function sdpToJingle(sdp: import("./types").SessionDescription, options: import("./types").JingleConversionOptions): Element;
/**
 * Build a Jingle transport-info `<jingle>` carrying a single trickled candidate.
 * @param {import('./types').SdpCandidate} candidate
 * @param {{ sid: string, mid: string, ufrag: string, pwd: string,
 *           initiator?: string, responder?: string, creator?: 'initiator'|'responder' }} options
 * @returns {Element}
 */
export function buildTransportInfo(candidate: import("./types").SdpCandidate, options: {
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
 * @param {import('./types').SessionDescription} sdp - our restart offer
 * @param {{ sid: string, initiator?: string, responder?: string }} options
 * @returns {Element}
 */
export function buildIceRestart(sdp: import("./types").SessionDescription, options: {
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
 * @param {import('./types').JingleConversionOptions} options
 * @returns {import('./types').SessionDescription}
 */
export function jingleToSDP(jingle: Element, options: import("./types").JingleConversionOptions): import("./types").SessionDescription;
//# sourceMappingURL=sdp.d.ts.map