import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';
import { parseSDP, sdpToJingle } from './sdp.js';
import { ENDED_REASONS } from './constants.js';

const { stx } = converse.env;

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
     */
    constructor(call, peer_jid) {
        this.call = call;
        this.peer_jid = peer_jid;
        this.pc = null;
    }

    get sid() {
        return this.call.sid;
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
                initiator: _converse.session.get('jid'),
                responder: this.peer_jid,
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

    /** @param {Element} jingle - a `<jingle>` payload from {@link sdpToJingle} */
    sendJingle(jingle) {
        const iq = stx`<iq xmlns="jabber:client" type="set" to="${this.peer_jid}">${jingle}</iq>`;
        api.sendIQ(iq).catch((e) => log.error(e));
    }

    close() {
        this.pc?.close();
        this.pc = null;
    }
}

export default RTPSession;
