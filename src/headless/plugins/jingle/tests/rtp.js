import { vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, sizzle, u } = converse.env;
const { webrtc } = converse.env.jingle;
const JMI = 'urn:xmpp:jingle-message:0';
const JINGLE = 'urn:xmpp:jingle:1';
const JINGLE_ERRORS = 'urn:xmpp:jingle:errors:1';
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
function installFakeWebRTC({ getUserMedia, pcOverrides } = {}) {
    saved = { RTCPeerConnection: webrtc.RTCPeerConnection, getUserMedia: webrtc.getUserMedia };
    const handle = { pc: null };
    webrtc.RTCPeerConnection = function (config) {
        handle.pc = Object.assign(new FakePeerConnection(config), pcOverrides);
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
        'buffers an inbound candidate until the remote description is applied',
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
            expect(webrtc_handle.pc.candidates.length).toBe(0);
            expect(sentIq(_converse, 'result', 'ti-iq')).toBeDefined();

            receiveIq(_converse, `${jid}/phone`, 'accept-iq', jingle('session-accept', sid));

            await u.waitUntil(() => webrtc_handle.pc.candidates.length);
            expect(webrtc_handle.pc.candidates[0].candidate).toContain('192.0.2.9 20000 typ host');
            expect(webrtc_handle.pc.candidates[0].sdpMid).toBe('0');
        })
    );

    it(
        'releases the microphone when the call ends while it is being captured',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const stream = fakeStream();
            const [track] = stream.getTracks();
            const stop = vi.spyOn(track, 'stop');
            let resolveMedia;
            installFakeWebRTC({ getUserMedia: () => new Promise((resolve) => (resolveMedia = resolve)) });
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);
            await u.waitUntil(() => resolveMedia);

            call.hangup(); // while the browser is still asking for permission
            resolveMedia(stream);

            await u.waitUntil(() => stop.mock.calls.length);
            expect(call.local_stream).toBe(null);
            expect(lastJingleIq(_converse, 'session-initiate')).toBeUndefined();
            const terminates = _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => sizzle(`jingle[action="session-terminate"]`, s).length);
            expect(terminates.length).toBe(1); // the hangup's own, no second one from a failure
        })
    );

    it(
        'fails the call and releases the microphone when the peer refuses our session-initiate',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const stream = fakeStream();
            const stop = vi.spyOn(stream.getTracks()[0], 'stop');
            installFakeWebRTC({ getUserMedia: () => Promise.resolve(stream) });
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);
            const initiate = await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            const error = stx`
                <iq xmlns="jabber:client" type="error" from="${jid}/phone" to="${_converse.session.get('jid')}"
                    id="${initiate.getAttribute('id')}">
                    <error type="cancel"><item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, error));

            await u.waitUntil(() => call.get('state') === 'failed');
            expect(call.get('ended_reason')).toBe('failed-application');
            expect(stop).toHaveBeenCalled();
        })
    );

    it(
        'ends an accepted call when the caller terminates it before the session starts',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="in5"><description xmlns="${RTP}" media="audio"/></propose>`
            );
            const call = _converse.state.calls.get('in5');
            call.accept();

            const term = stx`
                <jingle xmlns="${JINGLE}" action="session-terminate" sid="in5">
                    <reason><cancel/></reason>
                </jingle>`;
            receiveIq(_converse, `${jid}/phone`, 'term-iq', term);

            expect(call.get('state')).toBe('ended');
            expect(call.get('ended_reason')).toBe('cancelled');
            expect(sentIq(_converse, 'result', 'term-iq')).toBeDefined();
        })
    );

    it(
        'tells the caller when we hang up an accepted call before the session starts',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="in6"><description xmlns="${RTP}" media="audio"/></propose>`
            );
            const call = _converse.state.calls.get('in6');
            call.accept();
            call.hangup();

            const term = lastJingleIq(_converse, 'session-terminate');
            expect(term.getAttribute('to')).toBe(`${jid}/phone`);
            expect(sizzle(`jingle[sid="in6"] > reason > cancel`, term).length).toBe(1);
            expect(call.get('state')).toBe('ended');
        })
    );

    it(
        "reads the peer's reason for ending the call even when it includes a text",
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            const term = stx`
                <jingle xmlns="${JINGLE}" action="session-terminate" sid="${sid}">
                    <reason><failed-transport/><text>No route to host</text></reason>
                </jingle>`;
            receiveIq(_converse, `${jid}/phone`, 'term-iq', term);

            expect(call.get('state')).toBe('failed');
            expect(call.get('ended_reason')).toBe('connectivity-error');
        })
    );

    it(
        'handles each Jingle IQ once after a reconnection',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
            receiveIq(_converse, `${jid}/phone`, 'accept-iq', jingle('session-accept', sid));
            await u.waitUntil(() => webrtc_handle.pc.remoteDescription);

            _converse.api.trigger('reconnected');

            const ti = stx`
                <jingle xmlns="${JINGLE}" action="transport-info" sid="${sid}">
                    <content xmlns="${JINGLE}" creator="initiator" name="0">
                        <transport xmlns="urn:xmpp:jingle:transports:ice-udp:1" ufrag="abc" pwd="pwd">
                            <candidate
                                component="1" foundation="1" generation="0" id="c1" ip="192.0.2.9"
                                network="0" port="20000" priority="2113937151" protocol="udp" type="host"/>
                        </transport>
                    </content>
                </jingle>`;
            receiveIq(_converse, `${jid}/phone`, 'ti-iq', ti);

            const results = _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => s.getAttribute('type') === 'result' && s.getAttribute('id') === 'ti-iq');
            expect(results.length).toBe(1);
            expect(webrtc_handle.pc.candidates.length).toBe(1);
        })
    );

    it(
        'drops a trickled candidate with a line break in a value',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
            receiveIq(_converse, `${jid}/phone`, 'accept-iq', jingle('session-accept', sid));
            await u.waitUntil(() => webrtc_handle.pc.remoteDescription);

            const ti = stx`
                <jingle xmlns="${JINGLE}" action="transport-info" sid="${sid}">
                    <content xmlns="${JINGLE}" creator="initiator" name="0">
                        <transport xmlns="urn:xmpp:jingle:transports:ice-udp:1" ufrag="abc" pwd="pwd">
                            <candidate
                                component="1" foundation="1" generation="0" id="c1" ip="192.0.2.8"
                                network="0" port="20000" priority="2113937151" protocol="udp" type="host"/>
                            <candidate
                                component="1" foundation="2" generation="0" id="c2" ip="192.0.2.9"
                                network="0" port="20000" priority="2113937151" protocol="udp" type="host"/>
                        </transport>
                    </content>
                </jingle>`.tree();
            // Set directly: a line break in serialised XML would be normalised away.
            sizzle('candidate', ti).pop().setAttribute('ip', '192.0.2.9\r\na=evil');
            call.session.handleJingle('transport-info', ti);

            expect(webrtc_handle.pc.candidates.map((c) => c.candidate)).toEqual([
                'candidate:1 1 udp 2113937151 192.0.2.8 20000 typ host generation 0',
            ]);
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
            expect(lastJingleIq(_converse, 'session-terminate')).toBeDefined();
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
        'answers an incoming call with session-accept',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);

            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="in1"><description xmlns="${RTP}" media="audio"/></propose>`
            );
            const call = _converse.state.calls.get('in1');
            call.accept();
            expect(call.get('state')).toBe('connecting');

            receiveIq(_converse, `${jid}/phone`, 'init-iq', jingle('session-initiate', 'in1'));

            const accept = await u.waitUntil(() => lastJingleIq(_converse, 'session-accept'));
            expect(accept.getAttribute('to')).toBe(`${jid}/phone`);
            expect(sizzle(`description[xmlns="${RTP}"]`, accept).pop().getAttribute('media')).toBe('audio');
            expect(call.local_stream).toBeTruthy();
            expect(sentIq(_converse, 'result', 'init-iq')).toBeDefined();

            webrtc_handle.pc.connectionState = 'connected';
            webrtc_handle.pc.onconnectionstatechange();
            expect(call.get('state')).toBe('active');
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
            // The peer is told, so it stops waiting for a session-initiate.
            expect(lastJingleIq(_converse, 'session-terminate')).toBeDefined();
        })
    );

    it(
        'fails and tells the peer when the answer cannot be applied',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC({ pcOverrides: { setRemoteDescription: () => Promise.reject(new Error('bad sdp')) } });
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            receiveIq(_converse, `${jid}/phone`, 'accept-iq', jingle('session-accept', sid));

            await u.waitUntil(() => call.get('state') === 'failed');
            expect(call.get('ended_reason')).toBe('failed-application');
            const term = lastJingleIq(_converse, 'session-terminate');
            expect(sizzle('reason > failed-application', term).length).toBe(1);
        })
    );

    it(
        "rejects Jingle IQs from anyone but the session's peer",
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            const jid = await getContactJid(_converse, 0);
            const stranger = await getContactJid(_converse, 1);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            const term = stx`
                <jingle xmlns="${JINGLE}" action="session-terminate" sid="${sid}">
                    <reason><success/></reason>
                </jingle>`;
            receiveIq(_converse, `${stranger}/phone`, 'spoof-iq', term);

            const error = sentIq(_converse, 'error', 'spoof-iq');
            expect(sizzle('item-not-found', error).length).toBe(1);
            expect(sizzle(`unknown-session[xmlns="${JINGLE_ERRORS}"]`, error).length).toBe(1);
            expect(call.get('state')).toBe('connecting');
        })
    );

    it(
        "answers only the proposing resource, ignoring the offer's initiator attribute",
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            const jid = await getContactJid(_converse, 0);
            const stranger = await getContactJid(_converse, 1);
            const { parseSDP, sdpToJingle } = converse.env.jingle;

            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="in2"><description xmlns="${RTP}" media="audio"/></propose>`
            );
            const call = _converse.state.calls.get('in2');
            call.accept();

            // Someone else can't start the session for this call...
            receiveIq(_converse, `${stranger}/phone`, 'spoof-iq', jingle('session-initiate', 'in2'));
            const error = sentIq(_converse, 'error', 'spoof-iq');
            expect(sizzle('item-not-found', error).length).toBe(1);
            expect(call.session).toBe(null);

            // ...and the caller can't redirect our answer elsewhere via `initiator`.
            const offer = sdpToJingle(parseSDP(OFFER_SDP), {
                action: 'session-initiate',
                sid: 'in2',
                initiator: 'mallory@evil.lit/x',
                is_initiator: false,
            });
            receiveIq(_converse, `${jid}/phone`, 'init-iq', offer);

            const accept = await u.waitUntil(() => lastJingleIq(_converse, 'session-accept'));
            expect(accept.getAttribute('to')).toBe(`${jid}/phone`);
            expect(sizzle(`jingle[xmlns="${JINGLE}"]`, accept).pop().getAttribute('initiator')).toBe(`${jid}/phone`);
        })
    );

    it(
        'ignores <ringing>, <proceed> and <reject> once the callee has proceeded',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
            const { session } = call;
            const { pc } = webrtc_handle;

            // The callee's other devices may still be ringing and answer late.
            receive(_converse, `${jid}/laptop`, stx`<ringing xmlns="${JMI}" id="${sid}"/>`);
            receive(_converse, `${jid}/laptop`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            receive(_converse, `${jid}/laptop`, stx`<reject xmlns="${JMI}" id="${sid}"/>`);

            expect(call.get('state')).toBe('connecting');
            expect(call.session).toBe(session);
            expect(webrtc_handle.pc).toBe(pc);
        })
    );

    it(
        'does not answer a session-initiate before the user accepts the call',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            let captured = false;
            installFakeWebRTC({
                getUserMedia: () => {
                    captured = true;
                    return Promise.resolve(fakeStream());
                },
            });
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="in3"><description xmlns="${RTP}" media="audio"/></propose>`
            );
            const call = _converse.state.calls.get('in3');

            receiveIq(_converse, `${jid}/phone`, 'early-iq', jingle('session-initiate', 'in3'));

            const error = sentIq(_converse, 'error', 'early-iq');
            expect(sizzle('unexpected-request', error).length).toBe(1);
            expect(sizzle(`out-of-order[xmlns="${JINGLE_ERRORS}"]`, error).length).toBe(1);
            expect(call.get('state')).toBe('ringing');
            expect(call.session).toBe(null);
            expect(captured).toBe(false);
            expect(lastJingleIq(_converse, 'session-accept')).toBeUndefined();
        })
    );

    it(
        'rejects a second session-initiate for a session already under way',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const webrtc_handle = installFakeWebRTC();
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="in4"><description xmlns="${RTP}" media="audio"/></propose>`
            );
            const call = _converse.state.calls.get('in4');
            call.accept();
            receiveIq(_converse, `${jid}/phone`, 'init-iq', jingle('session-initiate', 'in4'));
            await u.waitUntil(() => lastJingleIq(_converse, 'session-accept'));
            const { pc } = webrtc_handle;
            const { local_stream } = call;

            receiveIq(_converse, `${jid}/phone`, 'again-iq', jingle('session-initiate', 'in4'));

            const error = sentIq(_converse, 'error', 'again-iq');
            expect(sizzle(`out-of-order[xmlns="${JINGLE_ERRORS}"]`, error).length).toBe(1);
            expect(webrtc_handle.pc).toBe(pc);
            expect(call.local_stream).toBe(local_stream);
        })
    );

    it(
        'rejects a session-initiate for a call we started ourselves',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            receiveIq(_converse, `${jid}/phone`, 'reverse-iq', jingle('session-initiate', sid));

            const error = sentIq(_converse, 'error', 'reverse-iq');
            expect(sizzle(`out-of-order[xmlns="${JINGLE_ERRORS}"]`, error).length).toBe(1);
            expect(lastJingleIq(_converse, 'session-accept')).toBeUndefined();
        })
    );
});
