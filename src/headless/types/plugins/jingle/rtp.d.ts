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
    get sid(): string;
    get initiator(): any;
    get responder(): any;
    /** Open the peer connection, capture the mic, and send a session-initiate. */
    initiate(): Promise<void>;
    createConnection(): void;
    /** The peer's media arrived: expose the remote stream. */
    onRemoteTrack(ev: any): void;
    onConnectionStateChange(): void;
    /** A locally gathered ICE candidate: trickle it to the peer. */
    onLocalCandidate(ev: any): void;
    addLocalMedia(): Promise<void>;
    /**
     * Dispatch an inbound Jingle action (already routed to this session).
     * @param {string} action
     * @param {Element} jingle
     */
    handleJingle(action: string, jingle: Element): void;
    /** @param {Element} jingle */
    onSessionAccept(jingle: Element): Promise<void>;
    /** @param {Element} jingle - a transport-info carrying one or more candidates */
    onTransportInfo(jingle: Element): void;
    /** @param {Element} jingle - the peer hung up */
    onSessionTerminate(jingle: Element): void;
    /**
     * Tell the peer we're hanging up.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    terminate(reason: string): void;
    /** @param {Element} jingle - a `<jingle>` payload from {@link sdpToJingle} */
    sendJingle(jingle: Element): void;
    close(): void;
}
//# sourceMappingURL=rtp.d.ts.map