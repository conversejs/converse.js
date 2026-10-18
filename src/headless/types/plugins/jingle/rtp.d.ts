/**
 * Tell `to` that the Jingle session `sid` is over.
 * @param {string} to
 * @param {string} sid
 * @param {string} reason - one of {@link ENDED_REASONS}
 */
export function sendSessionTerminate(to: string, sid: string, reason: string): void;
/**
 * End a call the way the peer's session-terminate says.
 * @param {import('./model.js').default} call
 * @param {Element} jingle - the peer's session-terminate
 */
export function endCallFromTerminate(call: import("./model.js").default, jingle: Element): void;
export namespace webrtc {
    let RTCPeerConnection: {
        new (configuration?: RTCConfiguration): RTCPeerConnection;
        prototype: RTCPeerConnection;
        generateCertificate(keygenAlgorithm: AlgorithmIdentifier): Promise<RTCCertificate>;
    };
    function getUserMedia(constraints: any): Promise<MediaStream>;
}
export default RTPSession;
/**
 * The Jingle RTP session behind a {@link Call}: owns the RTCPeerConnection and
 * drives session-initiate/accept/transport-info/terminate. Created lazily once
 * a call reaches `connecting`.
 */
declare class RTPSession {
    /**
     * @param {import('./model.js').default} call
     * @param {string} peer_jid - full JID of the remote endpoint
     * @param {boolean} [is_initiator=true] - whether we offer (outgoing) or answer
     */
    constructor(call: import("./model.js").default, peer_jid: string, is_initiator?: boolean);
    call: import("./model.js").default;
    peer_jid: string;
    is_initiator: boolean;
    pc: RTCPeerConnection;
    pending_candidates: any[];
    closed: boolean;
    get sid(): string;
    get initiator(): any;
    get responder(): any;
    /** Open the peer connection, capture the mic, and send a session-initiate. */
    initiate(): Promise<void>;
    /** @returns {Promise<boolean>} false if the call ended while the ICE servers were being fetched */
    createConnection(): Promise<boolean>;
    /** The peer's media arrived: expose the remote stream. */
    onRemoteTrack(ev: any): void;
    onConnectionStateChange(): void;
    /** A locally gathered ICE candidate: trickle it to the peer. */
    onLocalCandidate(ev: any): void;
    /**
     * @returns {Promise<boolean>} false if the microphone couldn't be captured,
     *      or the call ended while the browser was asking for permission
     */
    addLocalMedia(): Promise<boolean>;
    /**
     * The error to refuse an inbound Jingle action with, if any (XEP-0166).
     * @param {string} action
     * @param {Element} jingle
     * @returns {'feature-not-implemented'|'unsupported-info'|null}
     */
    refusal(action: string, jingle: Element): "feature-not-implemented" | "unsupported-info" | null;
    /**
     * Dispatch an inbound Jingle action (already routed to this session and acked).
     * @param {string} action
     * @param {Element} jingle
     */
    handleJingle(action: string, jingle: Element): void;
    /**
     * @param {Element} jingle - the peer's content-add or transport-replace
     * @param {'content-reject'|'transport-reject'} action
     * @param {import('strophe.js').Builder} condition - the Jingle reason condition
     */
    rejectContents(jingle: Element, action: "content-reject" | "transport-reject", condition: import("strophe.js").Builder): void;
    /** @param {Element} jingle - the caller's offer; answer it. */
    onSessionInitiate(jingle: Element): Promise<void>;
    /** @param {Element} jingle */
    onSessionAccept(jingle: Element): Promise<void>;
    /** @param {Element} jingle - a transport-info carrying one or more candidates */
    onTransportInfo(jingle: Element): void;
    flushCandidates(): void;
    /** @param {Element} jingle - the peer hung up */
    onSessionTerminate(jingle: Element): void;
    /**
     * Abnormal end on our side: tell the peer with a session-terminate, then fail
     * the call locally.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    fail(reason: string): void;
    /**
     * Tell the peer we're hanging up.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    terminate(reason: string): void;
    /**
     * @param {Element} jingle - a `<jingle>` payload from {@link sdpToJingle}
     * @param {boolean} [required=false] - the session can't continue if the peer refuses it
     */
    sendJingle(jingle: Element, required?: boolean): void;
    close(): void;
}
//# sourceMappingURL=rtp.d.ts.map