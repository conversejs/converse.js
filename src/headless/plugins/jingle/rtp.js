import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';
import {
    buildIceRestart,
    buildTransportInfo,
    candidateFromLine,
    candidateToLine,
    elementToCandidate,
    iceCredentials,
    isUdpCandidate,
    jingleToSDP,
    parseSDP,
    restartedDescription,
    sdpToJingle,
    transportCredentials,
    writeSDP,
} from './sdp.js';
import { CALL_STATES, CONNECT_TIMEOUT, ENDED_REASONS } from './constants.js';
import { getIceServers } from './extdisco.js';
import { endCallFromReason, reasonCondition } from './reasons.js';

const { Strophe, sizzle, stx } = converse.env;

// Actions RTPSession.handleJingle answers. Anything else is refused.
const HANDLED_ACTIONS = [
    'session-initiate',
    'session-accept',
    'session-info',
    'session-terminate',
    'transport-info',
    'content-add',
    'transport-replace',
];

/**
 * Tell `to` that the Jingle session `sid` is over.
 * @param {string} to
 * @param {string} sid
 * @param {string} reason - one of {@link ENDED_REASONS}
 */
export function sendSessionTerminate(to, sid, reason) {
    if (!api.connection.connected()) return; // nothing to send to (e.g. terminating on disconnect)
    const iq = stx`
        <iq xmlns="jabber:client" type="set" to="${to}">
            <jingle xmlns="${Strophe.NS.JINGLE}" action="session-terminate" sid="${sid}">
                <reason>${reasonCondition(reason)}</reason>
            </jingle>
        </iq>`;
    api.sendIQ(iq).catch((e) => log.error(e));
}

// Swappable WebRTC backend, so that the specs can use fakes. Unset, the
// globals are used, looked up when needed rather than when this module loads,
// so that a polyfill installed later (e.g. under Node.js) counts too.
export const webrtc = {
    /** @type {typeof RTCPeerConnection|null} */
    RTCPeerConnection: null,
    getUserMedia: (constraints) => globalThis.navigator.mediaDevices.getUserMedia(constraints),
};

/** @returns {typeof RTCPeerConnection|undefined} the implementation calls use, if there is one */
export function getRTCPeerConnection() {
    return webrtc.RTCPeerConnection ?? globalThis.RTCPeerConnection;
}

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
        // Kept, as the call takes another session's id if the peer moves it to one.
        this.sid = call.sid;
        this.peer_jid = peer_jid;
        this.is_initiator = is_initiator;
        this.pc = null;
        this.pending_candidates = [];
        this.closed = false;
        // Whether ICE connected since the session started or was last restarted.
        this.has_connected = false;
        // Our pending offer to restart ICE, until the peer answers it.
        this.ice_restart = null;
        // Local candidates of our restart, held back until the peer has acked it.
        this.held_candidates = null;
        // Whether the peer's restart is being applied; its candidates wait for it.
        this.applying_restart = false;
        this.restart_timeout = null;
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
            if (!(await this.createConnection())) return;
            if (!(await this.addLocalMedia())) return;

            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            const jingle = sdpToJingle(parseSDP(offer.sdp), {
                action: 'session-initiate',
                sid: this.sid,
                initiator: this.initiator,
                responder: this.responder,
                is_initiator: true,
            });
            this.sendJingle(jingle, true);
        } catch (e) {
            log.error(e);
            this.fail(ENDED_REASONS.FAILED_APPLICATION);
        }
    }

    /** @returns {Promise<boolean>} false if the call ended while the ICE servers were being fetched */
    async createConnection() {
        // The configured servers plus whatever the server advertised via
        // XEP-0215 (discovered on connect, see the jingle plugin).
        const configured = api.settings.get('call_ice_servers') ?? [];
        const discovered = await getIceServers();
        if (this.closed) return false;
        const PeerConnection = getRTCPeerConnection();
        this.pc = new PeerConnection({ iceServers: [...configured, ...discovered] });
        this.pc.onicecandidate = (ev) => this.onLocalCandidate(ev);
        this.pc.ontrack = (ev) => this.onRemoteTrack(ev);
        this.pc.onconnectionstatechange = () => this.onConnectionStateChange();
        return true;
    }

    /** The peer's media arrived: expose the remote stream. */
    onRemoteTrack(ev) {
        this.call.remote_stream = ev.streams[0];
        this.call.trigger('stream', { kind: 'remote' });
    }

    onConnectionStateChange() {
        if (!this.pc) return;
        if (this.pc.connectionState === 'connected') {
            this.has_connected = true;
            clearTimeout(this.restart_timeout);
            if (this.call.get('state') !== CALL_STATES.ACTIVE) {
                // A call the peer moved to a new session keeps the time it first connected.
                this.call.set({ state: CALL_STATES.ACTIVE, started_at: this.call.get('started_at') ?? Date.now() });
            }
        } else if (this.pc.connectionState === 'failed') {
            // A connection that worked can often be recovered, e.g. after a network change.
            if (this.has_connected) {
                this.restartIce();
            } else {
                this.fail(ENDED_REASONS.CONNECTIVITY_ERROR);
            }
        }
    }

    /**
     * Restart ICE: offer new credentials in a transport-info without candidates,
     * the way Conversations does, and trickle our new candidates once the peer
     * has acked it. The peer answers with candidates under its new credentials.
     */
    async restartIce() {
        this.#beginIceRestart();
        const restart = { peer_setup: this.#peerDtlsSetup() };
        const held = [];

        this.ice_restart = restart;
        this.held_candidates = held;

        try {
            const offer = await this.pc.createOffer({ iceRestart: true });
            if (this.closed || this.ice_restart !== restart) return; // we answered the peer's restart instead
            await this.pc.setLocalDescription(offer);
            const jingle = buildIceRestart(parseSDP(offer.sdp), {
                sid: this.sid,
                initiator: this.initiator,
                responder: this.responder,
            });
            await api.sendIQ(stx`<iq xmlns="jabber:client" type="set" to="${this.peer_jid}">${jingle}</iq>`);
        } catch (e) {
            // On a tie-break we wait for the initiator's own restart.
            if (this.closed || this.held_candidates !== held || isTieBreak(e)) return;
            log.error(e);
            this.fail(ENDED_REASONS.FAILED_APPLICATION);
            return;
        }

        if (this.closed || this.held_candidates !== held) return;

        this.held_candidates = null;
        held.forEach((ev) => this.onLocalCandidate(ev));
    }

    /** Whoever restarted, the restart has to connect, or the call ends. */
    #beginIceRestart() {
        this.has_connected = false;
        clearTimeout(this.restart_timeout);
        this.restart_timeout = setTimeout(() => {
            if (this.pc?.connectionState !== 'connected') this.fail(ENDED_REASONS.CONNECTIVITY_ERROR);
        }, CONNECT_TIMEOUT);
    }

    /** @returns {string} the DTLS role the peer took, which a restart doesn't change */
    #peerDtlsSetup() {
        const remote = parseSDP(this.pc.remoteDescription.sdp).media[0]?.setup;
        if (remote && remote !== 'actpass') return remote;

        const local = parseSDP(this.pc.localDescription.sdp).media[0]?.setup;
        return local === 'active' ? 'passive' : 'active';
    }

    /**
     * The ICE restart a transport-info carries, if its credentials are new.
     * Without candidates it offers one; with candidates while ours is pending,
     * it answers ours.
     * @param {Element} jingle
     * @returns {{ credentials: Map<string, { ufrag: string, pwd: string }>, is_offer: boolean }|null}
     */
    #iceRestartIn(jingle) {
        if (!this.pc?.remoteDescription) return null;

        const credentials = transportCredentials(jingle);
        const remote = parseSDP(this.pc.remoteDescription.sdp);
        const is_new = [...credentials].some(([mid, { ufrag }]) => {
            const media = remote.media.find((m) => String(m.mid) === mid);
            return ufrag !== iceCredentials(media, remote).ufrag;
        });
        if (!is_new) return null;

        const has_candidates = sizzle(`transport[xmlns="${Strophe.NS.JINGLE_ICE}"] > candidate`, jingle).length > 0;
        return { credentials, is_offer: !(has_candidates && this.ice_restart) };
    }

    /** @param {{ credentials: Map<string, { ufrag: string, pwd: string }>, is_offer: boolean }} restart */
    async #applyIceRestart({ credentials, is_offer }) {
        const remote_sdp = this.pc.remoteDescription.sdp;
        try {
            if (is_offer) {
                // If we offered a restart too, the browser rolls ours back.
                this.#beginIceRestart();
                this.ice_restart = null;
                this.held_candidates = null;
                const sdp = restartedDescription(remote_sdp, credentials, 'actpass');
                await this.pc.setRemoteDescription({ type: 'offer', sdp });
                await this.pc.setLocalDescription(await this.pc.createAnswer());
            } else {
                const sdp = restartedDescription(remote_sdp, credentials, this.ice_restart.peer_setup);
                this.ice_restart = null;
                await this.pc.setRemoteDescription({ type: 'answer', sdp });
            }
        } catch (e) {
            log.error(e);
            this.fail(ENDED_REASONS.FAILED_APPLICATION);
        } finally {
            this.applying_restart = false;
        }
        if (!this.closed) this.flushCandidates();
    }

    /** A locally gathered ICE candidate: trickle it to the peer. */
    onLocalCandidate(ev) {
        if (!ev.candidate?.candidate) return; // a null candidate marks the end of gathering
        if (this.held_candidates) {
            this.held_candidates.push(ev);
            return;
        }

        const candidate = candidateFromLine(ev.candidate.candidate);
        if (!isUdpCandidate(candidate)) return;

        const local = parseSDP(this.pc.localDescription.sdp);
        const { sdpMid, sdpMLineIndex } = ev.candidate;
        const media = local.media.find((m) => String(m.mid) === sdpMid) ?? local.media[sdpMLineIndex ?? 0];
        const { ufrag, pwd } = iceCredentials(media, local);
        const jingle = buildTransportInfo(candidate, {
            sid: this.sid,
            mid: sdpMid ?? String(media.mid),
            ufrag,
            pwd,
            initiator: this.initiator,
            responder: this.responder,
        });
        this.sendJingle(jingle);
    }

    /**
     * @returns {Promise<boolean>} false if the microphone couldn't be captured,
     *      or the call ended while the browser was asking for permission
     */
    async addLocalMedia() {
        const media = this.call.get('media');
        let stream;
        try {
            stream = await webrtc.getUserMedia({
                audio: media.includes('audio'),
                video: media.includes('video'),
            });
        } catch (e) {
            log.error(e);
            this.fail(ENDED_REASONS.NO_MEDIA);
            return false;
        }
        if (this.closed) {
            stream.getTracks().forEach((track) => track.stop());
            return false;
        }
        // Muted before a migration, the call stays muted in its new session.
        if (this.call.get('muted_audio')) {
            stream.getAudioTracks().forEach((track) => (track.enabled = false));
        }
        this.call.local_stream = stream;
        stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
        this.call.trigger('stream', { kind: 'local' });
        return true;
    }

    /**
     * The error to refuse an inbound Jingle action with, if any (XEP-0166).
     * @param {string} action
     * @param {Element} jingle
     * @returns {'feature-not-implemented'|'unsupported-info'|'tie-break'|null}
     */
    refusal(action, jingle) {
        if (!HANDLED_ACTIONS.includes(action)) return 'feature-not-implemented';

        // Both sides offered to restart ICE: the initiator's offer wins.
        const glare = action === 'transport-info' && this.is_initiator && this.ice_restart;
        if (glare && this.#iceRestartIn(jingle)?.is_offer) return 'tie-break';

        // An empty session-info is a ping; XEP-0167 info payloads (ringing, mute,
        // hold...) are only informational, so there is nothing to act on.
        const payload = action === 'session-info' ? jingle.firstElementChild : null;
        if (payload && payload.namespaceURI !== Strophe.NS.JINGLE_RTP_INFO) return 'unsupported-info';

        return null;
    }

    /**
     * Dispatch an inbound Jingle action (already routed to this session and acked).
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
            // Each content-add and transport-replace must be answered, and we
            // support neither more media nor another transport.
            case 'content-add':
                this.rejectContents(jingle, 'content-reject', stx`<unsupported-applications/>`);
                break;
            case 'transport-replace':
                this.rejectContents(jingle, 'transport-reject', stx`<unsupported-transports/>`);
                break;
        }
    }

    /**
     * @param {Element} jingle - the peer's content-add or transport-replace
     * @param {'content-reject'|'transport-reject'} action
     * @param {import('strophe.js').Builder} condition - the Jingle reason condition
     */
    rejectContents(jingle, action, condition) {
        const contents = sizzle('> content', jingle).map(
            (c) => stx`<content creator="${c.getAttribute('creator')}" name="${c.getAttribute('name')}"/>`,
        );
        this.sendJingle(stx`
            <jingle xmlns="${Strophe.NS.JINGLE}" action="${action}" sid="${this.sid}">
                ${contents}
                <reason>${condition}</reason>
            </jingle>`);
    }

    /** @param {Element} jingle - the caller's offer; answer it. */
    async onSessionInitiate(jingle) {
        try {
            if (!(await this.createConnection())) return;
            // A remote description carries the peer's perspective, so render it
            // from the builder's role (the caller) - not our own.
            const offer = writeSDP(jingleToSDP(jingle, { is_initiator: true, sid: this.sid }));
            await this.pc.setRemoteDescription({ type: 'offer', sdp: offer });
            this.flushCandidates();

            if (!(await this.addLocalMedia())) return;

            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);

            const reply = sdpToJingle(parseSDP(answer.sdp), {
                action: 'session-accept',
                sid: this.sid,
                initiator: this.initiator,
                responder: this.responder,
                is_initiator: false,
            });
            this.sendJingle(reply, true);
        } catch (e) {
            log.error(e);
            this.fail(ENDED_REASONS.FAILED_APPLICATION);
        }
    }

    /** @param {Element} jingle */
    async onSessionAccept(jingle) {
        try {
            // The answer is the peer's (responder's) perspective; render it as such.
            const sdp = writeSDP(jingleToSDP(jingle, { is_initiator: false, sid: this.sid }));
            await this.pc.setRemoteDescription({ type: 'answer', sdp });
            this.flushCandidates();
        } catch (e) {
            log.error(e);
            this.fail(ENDED_REASONS.FAILED_APPLICATION);
        }
    }

    /** @param {Element} jingle - a transport-info carrying candidates, or an ICE restart */
    onTransportInfo(jingle) {
        const restart = this.applying_restart ? null : this.#iceRestartIn(jingle);
        if (restart) {
            this.applying_restart = true;
            this.#applyIceRestart(restart);
        }

        sizzle('content', jingle).forEach((content) => {
            const mid = content.getAttribute('name');
            sizzle(`transport[xmlns="${Strophe.NS.JINGLE_ICE}"] > candidate`, content).forEach((el) => {
                let parsed;
                try {
                    parsed = elementToCandidate(el);
                } catch (e) {
                    log.warn(e); // drop the malformed candidate, keep the rest
                    return;
                }
                if (!isUdpCandidate(parsed)) return;

                const line = candidateToLine(parsed);
                const candidate = { candidate: line, sdpMid: mid };
                // A peer can trickle candidates before its description is applied;
                // addIceCandidate rejects until then, so hold them back.
                if (this.pc?.remoteDescription && !this.applying_restart) {
                    this.pc.addIceCandidate(candidate).catch((e) => log.error(e));
                } else {
                    this.pending_candidates.push(candidate);
                }
            });
        });
    }

    flushCandidates() {
        this.pending_candidates.forEach((c) => this.pc.addIceCandidate(c).catch((e) => log.error(e)));
        this.pending_candidates = [];
    }

    /** @param {Element} jingle - the peer hung up */
    onSessionTerminate(jingle) {
        endCallFromReason(this.call, jingle);
    }

    /**
     * Abnormal end on our side: tell the peer with a session-terminate, then fail
     * the call locally.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    fail(reason) {
        if (this.closed) return; // the call is already over and the peer was told
        this.terminate(reason);
        this.call.fail(reason);
    }

    /**
     * Tell the peer we're hanging up.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    terminate(reason) {
        sendSessionTerminate(this.peer_jid, this.sid, reason);
    }

    /**
     * @param {Element} jingle - a `<jingle>` payload from {@link sdpToJingle}
     * @param {boolean} [required=false] - the session can't continue if the peer refuses it
     */
    sendJingle(jingle, required = false) {
        if (!api.connection.connected()) return; // nothing to send to (e.g. terminating on disconnect)
        const iq = stx`<iq xmlns="jabber:client" type="set" to="${this.peer_jid}">${jingle}</iq>`;
        api.sendIQ(iq).catch((e) => {
            log.error(e);
            if (required) this.fail(ENDED_REASONS.FAILED_APPLICATION);
        });
    }

    close() {
        this.closed = true;
        clearTimeout(this.restart_timeout);
        // Closing the peer connection doesn't release the mic/camera - the
        // local getUserMedia tracks have to be stopped explicitly, otherwise the
        // OS keeps showing the device as in use after the call ends.
        this.call.local_stream?.getTracks().forEach((track) => track.stop());
        this.call.local_stream = null;
        this.call.remote_stream = null;
        this.pc?.close();
        this.pc = null;
    }
}

/** @param {unknown} error - what a refused IQ rejects with */
function isTieBreak(error) {
    return error instanceof Element && sizzle(`tie-break[xmlns="${Strophe.NS.JINGLE_ERRORS}"]`, error).length > 0;
}

export default RTPSession;
