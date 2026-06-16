import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';
import {
    buildTransportInfo,
    candidateFromLine,
    candidateToLine,
    elementToCandidate,
    jingleToSDP,
    parseSDP,
    sdpToJingle,
    writeSDP,
} from './sdp.js';
import { CALL_STATES, ENDED_REASONS } from './constants.js';

const { Strophe, sizzle, stx } = converse.env;

// Our end reason -> the Jingle <reason> condition we send on session-terminate.
const REASON_ELEMENT = {
    [ENDED_REASONS.SUCCESS]: () => stx`<success/>`,
    [ENDED_REASONS.CANCELLED]: () => stx`<cancel/>`,
    [ENDED_REASONS.DECLINED]: () => stx`<decline/>`,
};

// A received Jingle <reason> condition -> our end reason.
const REASON_FROM_JINGLE = {
    success: ENDED_REASONS.SUCCESS,
    decline: ENDED_REASONS.DECLINED,
    busy: ENDED_REASONS.DECLINED,
    cancel: ENDED_REASONS.CANCELLED,
    'connectivity-error': ENDED_REASONS.CONNECTIVITY_ERROR,
    timeout: ENDED_REASONS.CONNECTIVITY_ERROR,
};

// Swappable WebRTC backend: the browser globals in production, fakes in the
// signalling specs. The media-loopback test leaves these as the real thing.
export const webrtc = {
    RTCPeerConnection: globalThis.RTCPeerConnection,
    getUserMedia: (constraints) => globalThis.navigator.mediaDevices.getUserMedia(constraints),
};

/**
 * The Jingle RTP session behind a {@link Call}: owns the RTCPeerConnection and
 * drives session-initiate/accept/transport-info/terminate. Created lazily once
 * a call reaches `connecting`.
 */
class RTPSession {
    /**
     * @param {import('./model.js').default} call
     * @param {string} peer_jid - full JID of the remote endpoint
     * @param {boolean} [is_initiator=true] - whether we offer (outgoing) or answer
     */
    constructor(call, peer_jid, is_initiator = true) {
        this.call = call;
        this.peer_jid = peer_jid;
        this.is_initiator = is_initiator;
        this.pc = null;
    }

    get sid() {
        return this.call.sid;
    }

    get initiator() {
        return this.is_initiator ? _converse.session.get('jid') : this.peer_jid;
    }

    get responder() {
        return this.is_initiator ? this.peer_jid : _converse.session.get('jid');
    }

    /** Open the peer connection, capture the mic, and send a session-initiate. */
    async initiate() {
        try {
            this.createConnection();
            await this.addLocalMedia();

            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            const jingle = sdpToJingle(parseSDP(offer.sdp), {
                action: 'session-initiate',
                sid: this.sid,
                initiator: this.initiator,
                responder: this.responder,
                is_initiator: true,
            });
            this.sendJingle(jingle);
        } catch (e) {
            log.error(e);
            this.call.fail(ENDED_REASONS.NO_MEDIA);
        }
    }

    createConnection() {
        const iceServers = api.settings.get('call_ice_servers') ?? [];
        this.pc = new webrtc.RTCPeerConnection({ iceServers });
        this.pc.onicecandidate = (ev) => this.onLocalCandidate(ev);
        this.pc.ontrack = (ev) => this.onRemoteTrack(ev);
        this.pc.onconnectionstatechange = () => this.onConnectionStateChange();
    }

    /** The peer's media arrived: expose the remote stream. */
    onRemoteTrack(ev) {
        this.call.remote_stream = ev.streams[0];
        this.call.trigger('stream', { kind: 'remote' });
    }

    onConnectionStateChange() {
        if (this.pc.connectionState === 'connected') {
            if (this.call.get('state') !== CALL_STATES.ACTIVE) {
                this.call.set({ state: CALL_STATES.ACTIVE, started_at: Date.now() });
            }
        } else if (this.pc.connectionState === 'failed') {
            this.call.fail(ENDED_REASONS.CONNECTIVITY_ERROR);
        }
    }

    /** A locally gathered ICE candidate: trickle it to the peer. */
    onLocalCandidate(ev) {
        if (!ev.candidate?.candidate) return; // a null candidate marks the end of gathering

        const local = parseSDP(this.pc.localDescription.sdp).media[0];
        const jingle = buildTransportInfo(candidateFromLine(ev.candidate.candidate), {
            sid: this.sid,
            mid: ev.candidate.sdpMid ?? local.mid,
            ufrag: local.iceUfrag,
            pwd: local.icePwd,
            initiator: this.initiator,
            responder: this.responder,
        });
        this.sendJingle(jingle);
    }

    async addLocalMedia() {
        const media = this.call.get('media');
        const stream = await webrtc.getUserMedia({
            audio: media.includes('audio'),
            video: media.includes('video'),
        });
        this.call.local_stream = stream;
        stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
        this.call.trigger('stream', { kind: 'local' });
    }

    /**
     * Dispatch an inbound Jingle action (already routed to this session).
     * @param {string} action
     * @param {Element} jingle
     */
    handleJingle(action, jingle) {
        switch (action) {
            case 'session-initiate':
                this.onSessionInitiate(jingle);
                break;
            case 'session-accept':
                this.onSessionAccept(jingle);
                break;
            case 'transport-info':
                this.onTransportInfo(jingle);
                break;
            case 'session-terminate':
                this.onSessionTerminate(jingle);
                break;
        }
    }

    /** @param {Element} jingle - the caller's offer; answer it. */
    async onSessionInitiate(jingle) {
        try {
            this.createConnection();
            const offer = writeSDP(jingleToSDP(jingle, { is_initiator: false, sid: this.sid }));
            await this.pc.setRemoteDescription({ type: 'offer', sdp: offer });

            await this.addLocalMedia();
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);

            const reply = sdpToJingle(parseSDP(answer.sdp), {
                action: 'session-accept',
                sid: this.sid,
                initiator: this.initiator,
                responder: this.responder,
                is_initiator: false,
            });
            this.sendJingle(reply);
        } catch (e) {
            log.error(e);
            this.call.fail(ENDED_REASONS.NO_MEDIA);
        }
    }

    /** @param {Element} jingle */
    async onSessionAccept(jingle) {
        try {
            const sdp = writeSDP(jingleToSDP(jingle, { is_initiator: true, sid: this.sid }));
            await this.pc.setRemoteDescription({ type: 'answer', sdp });
        } catch (e) {
            log.error(e);
        }
    }

    /** @param {Element} jingle - a transport-info carrying one or more candidates */
    onTransportInfo(jingle) {
        sizzle('content', jingle).forEach((content) => {
            const mid = content.getAttribute('name');
            sizzle(`transport[xmlns="${Strophe.NS.JINGLE_ICE}"] > candidate`, content).forEach((el) => {
                const candidate = { candidate: candidateToLine(elementToCandidate(el)), sdpMid: mid };
                this.pc.addIceCandidate(candidate).catch((e) => log.error(e));
            });
        });
    }

    /** @param {Element} jingle - the peer hung up */
    onSessionTerminate(jingle) {
        const condition = sizzle('reason > *', jingle).pop()?.tagName ?? 'success';
        const reason = REASON_FROM_JINGLE[condition] ?? ENDED_REASONS.SUCCESS;
        if (reason === ENDED_REASONS.CONNECTIVITY_ERROR) {
            this.call.fail(reason);
        } else {
            this.call.end(reason);
        }
    }

    /**
     * Tell the peer we're hanging up.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    terminate(reason) {
        const condition = (REASON_ELEMENT[reason] ?? REASON_ELEMENT[ENDED_REASONS.SUCCESS])();
        const jingle = stx`
            <jingle xmlns="${Strophe.NS.JINGLE}" action="session-terminate" sid="${this.sid}">
                <reason>${condition}</reason>
            </jingle>`;
        this.sendJingle(jingle);
    }

    /** @param {Element} jingle - a `<jingle>` payload from {@link sdpToJingle} */
    sendJingle(jingle) {
        if (!api.connection.connected()) return; // nothing to send to (e.g. terminating on disconnect)
        const iq = stx`<iq xmlns="jabber:client" type="set" to="${this.peer_jid}">${jingle}</iq>`;
        api.sendIQ(iq).catch((e) => log.error(e));
    }

    close() {
        this.pc?.close();
        this.pc = null;
    }
}

export default RTPSession;
