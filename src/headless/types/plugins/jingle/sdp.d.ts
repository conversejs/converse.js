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
 * @param {SdpCandidate} candidate
 * @returns {Element}
 */
export function candidateToElement(candidate: SdpCandidate): Element;
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