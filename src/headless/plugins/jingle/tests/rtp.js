import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, sizzle, u } = converse.env;
const { webrtc } = converse.env.jingle;
const JMI = 'urn:xmpp:jingle-message:0';
const JINGLE = 'urn:xmpp:jingle:1';
const RTP = 'urn:xmpp:jingle:apps:rtp:1';

// A minimal but valid audio offer; sdpToJingle round-trips it (see tests/sdp.js).
const OFFER_SDP =
    'v=0\r\n' +
    'o=- 0 0 IN IP4 0.0.0.0\r\n' +
    's=-\r\n' +
    't=0 0\r\n' +
    'a=group:BUNDLE 0\r\n' +
    'm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' +
    'c=IN IP4 0.0.0.0\r\n' +
    'a=mid:0\r\n' +
    'a=sendrecv\r\n' +
    'a=rtcp-mux\r\n' +
    'a=ice-ufrag:abc\r\n' +
    'a=ice-pwd:thispasswordisatleast22chars\r\n' +
    'a=ice-options:trickle\r\n' +
    'a=fingerprint:sha-256 AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89\r\n' +
    'a=setup:actpass\r\n' +
    'a=rtpmap:111 opus/48000/2\r\n';

/** The most recent outbound Jingle IQ carrying the given action, if any. */
function lastJingleIq(_converse, action) {
    return _converse.api.connection
        .get()
        .sent_stanzas.filter(
            (s) => s.nodeName === 'iq' && sizzle(`jingle[xmlns="${JINGLE}"][action="${action}"]`, s).length
        )
        .pop();
}

function receive(_converse, from, child) {
    const stanza = stx`
        <message xmlns="jabber:client" from="${from}" to="${_converse.bare_jid}" type="chat">
            ${child}
        </message>`;
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
}

function receiveIq(_converse, from, id, child) {
    const iq = stx`
        <iq xmlns="jabber:client" type="set" from="${from}" to="${_converse.bare_jid}" id="${id}">${child}</iq>`;
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, iq));
}

/** A sent IQ of the given type carrying the given id, if any. */
function sentIq(_converse, type, id) {
    return _converse.api.connection
        .get()
        .sent_stanzas.filter(
            (s) => s.nodeName === 'iq' && s.getAttribute('type') === type && s.getAttribute('id') === id
        )
        .pop();
}

/** Build a `<jingle>` payload from our sample SDP for the given action. */
function jingle(action, sid) {
    const { parseSDP, sdpToJingle } = converse.env.jingle;
    return sdpToJingle(parseSDP(OFFER_SDP), { action, sid, is_initiator: false });
}

async function getContactJid(_converse, i = 0) {
    await mock.waitForRoster(_converse, 'current');
    return mock.cur_names[i].replace(/ /g, '.').toLowerCase() + '@montague.lit';
}

function fakeStream() {
    const track = { kind: 'audio', enabled: true, stop() {} };
    return { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] };
}

class FakePeerConnection {
    constructor(config) {
        this.config = config;
        this.localDescription = null;
        this.remoteDescription = null;
        this.senders = [];
        this.candidates = [];
        this.connectionState = 'new';
        this.onicecandidate = null;
        this.ontrack = null;
        this.onconnectionstatechange = null;
        this.closed = false;
    }
    addTrack(track) {
        this.senders.push(track);
    }
    createOffer() {
        return Promise.resolve({ type: 'offer', sdp: OFFER_SDP });
    }
    createAnswer() {
        return Promise.resolve({ type: 'answer', sdp: OFFER_SDP });
    }
    setLocalDescription(desc) {
        this.localDescription = desc;
        return Promise.resolve();
    }
    setRemoteDescription(desc) {
        this.remoteDescription = desc;
        return Promise.resolve();
    }
    addIceCandidate(candidate) {
        this.candidates.push(candidate);
        return Promise.resolve();
    }
    close() {
        this.closed = true;
    }
}

let saved;

/** Swap the browser WebRTC backend for fakes; returns a handle to the live PC. */
function installFakeWebRTC({ getUserMedia } = {}) {
    saved = { RTCPeerConnection: webrtc.RTCPeerConnection, getUserMedia: webrtc.getUserMedia };
    const handle = { pc: null };
    webrtc.RTCPeerConnection = function (config) {
        handle.pc = new FakePeerConnection(config);
        return handle.pc;
    };
    webrtc.getUserMedia = getUserMedia ?? (() => Promise.resolve(fakeStream()));
    return handle;
}

describe('A Jingle RTP session', function () {
    afterEach(() => saved && Object.assign(webrtc, saved));

    it(
        'sends a session-initiate after the callee <proceed>s',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            let local_fired = false;
            call.on('stream', ({ kind }) => kind === 'local' && (local_fired = true));

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            expect(call.get('state')).toBe('connecting');

            const iq = await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
            expect(iq.getAttribute('to')).toBe(`${jid}/phone`);

            const jingle = sizzle(`jingle[xmlns="${JINGLE}"]`, iq).pop();
            expect(jingle.getAttribute('sid')).toBe(sid);
            expect(jingle.getAttribute('responder')).toBe(`${jid}/phone`);

            const desc = sizzle(`description[xmlns="${RTP}"]`, iq).pop();
            expect(desc.getAttribute('media')).toBe('audio');

            expect(call.local_stream).toBeTruthy();
            expect(local_fired).toBe(true);
            expect(webrtc_handle.pc.senders.length).toBe(1);
        })
    );

    it(
        'applies the answer and acks when a session-accept arrives',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            receiveIq(_converse, `${jid}/phone`, 'accept-iq', jingle('session-accept', sid));

            await u.waitUntil(() => webrtc_handle.pc.remoteDescription);
            expect(webrtc_handle.pc.remoteDescription.type).toBe('answer');
            expect(webrtc_handle.pc.remoteDescription.sdp).toContain('m=audio');
            expect(sentIq(_converse, 'result', 'accept-iq')).toBeDefined();
        })
    );

    it(
        'returns item-not-found for a Jingle IQ with an unknown session',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            const jid = await getContactJid(_converse);

            receiveIq(_converse, `${jid}/phone`, 'stray-iq', jingle('session-accept', 'no-such-sid'));

            const error = sentIq(_converse, 'error', 'stray-iq');
            expect(error).toBeDefined();
            expect(sizzle('item-not-found', error).length).toBe(1);
        })
    );

    it(
        'trickles a locally gathered ICE candidate as transport-info',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            webrtc_handle.pc.onicecandidate({
                candidate: { candidate: 'candidate:1 1 udp 2113937151 192.0.2.1 10000 typ host', sdpMid: '0' },
            });

            const ti = await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));
            expect(ti.getAttribute('to')).toBe(`${jid}/phone`);
            const candidate = sizzle('candidate', ti).pop();
            expect(candidate.getAttribute('ip')).toBe('192.0.2.1');
            expect(candidate.getAttribute('port')).toBe('10000');
            expect(candidate.getAttribute('type')).toBe('host');

            // A null candidate marks the end of gathering and sends nothing further.
            webrtc_handle.pc.onicecandidate({ candidate: null });
            expect(lastJingleIq(_converse, 'transport-info')).toBe(ti);
        })
    );

    it(
        'adds a remote candidate from an inbound transport-info',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            const ti = stx`
                <jingle xmlns="${JINGLE}" action="transport-info" sid="${sid}">
                    <content xmlns="${JINGLE}" creator="initiator" name="0">
                        <transport
                            xmlns="urn:xmpp:jingle:transports:ice-udp:1" ufrag="abc"
                            pwd="thispasswordisatleast22chars">
                            <candidate
                                component="1" foundation="1" generation="0" id="c1" ip="192.0.2.9"
                                network="0" port="20000" priority="2113937151" protocol="udp" type="host"/>
                        </transport>
                    </content>
                </jingle>`;
            receiveIq(_converse, `${jid}/phone`, 'ti-iq', ti);

            await u.waitUntil(() => webrtc_handle.pc.candidates.length);
            expect(webrtc_handle.pc.candidates[0].candidate).toContain('192.0.2.9 20000 typ host');
            expect(webrtc_handle.pc.candidates[0].sdpMid).toBe('0');
            expect(sentIq(_converse, 'result', 'ti-iq')).toBeDefined();
        })
    );

    it(
        'goes active and exposes the remote stream once connected',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
            const pc = webrtc_handle.pc;

            const remote = fakeStream();
            let remote_fired = false;
            call.on('stream', ({ kind }) => kind === 'remote' && (remote_fired = true));
            pc.ontrack({ streams: [remote] });
            expect(call.remote_stream).toBe(remote);
            expect(remote_fired).toBe(true);

            pc.connectionState = 'connected';
            pc.onconnectionstatechange();
            expect(call.get('state')).toBe('active');
            expect(typeof call.get('started_at')).toBe('number');
        })
    );

    it(
        'fails the call when the peer connection fails',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            const pc = webrtc_handle.pc;
            pc.connectionState = 'failed';
            pc.onconnectionstatechange();
            expect(call.get('state')).toBe('failed');
            expect(call.get('ended_reason')).toBe('connectivity-error');
        })
    );

    it(
        'sends a session-terminate when hanging up an active call',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            webrtc_handle.pc.connectionState = 'connected';
            webrtc_handle.pc.onconnectionstatechange();
            expect(call.get('state')).toBe('active');

            call.hangup();

            const term = lastJingleIq(_converse, 'session-terminate');
            expect(term.getAttribute('to')).toBe(`${jid}/phone`);
            expect(sizzle('reason > success', term).length).toBe(1);
            expect(call.get('state')).toBe('ended');
            expect(call.get('ended_reason')).toBe('success');
        })
    );

    it(
        'ends the call when the peer sends a session-terminate',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            const term = stx`
                <jingle xmlns="${JINGLE}" action="session-terminate" sid="${sid}">
                    <reason><success/></reason>
                </jingle>`;
            receiveIq(_converse, `${jid}/phone`, 'term-iq', term);

            await u.waitUntil(() => call.get('state') === 'ended');
            expect(call.get('ended_reason')).toBe('success');
            expect(sentIq(_converse, 'result', 'term-iq')).toBeDefined();
        })
    );

    it(
        'fails the call when capturing the microphone is denied',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC({ getUserMedia: () => Promise.reject(new Error('NotAllowedError')) });
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);

            await u.waitUntil(() => call.get('state') === 'failed');
            expect(call.get('ended_reason')).toBe('no-media');
        })
    );
});
