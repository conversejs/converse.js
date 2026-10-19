import { vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, sizzle, u } = converse.env;
const { webrtc } = converse.env.u.jingle;
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

/** The `<finish/>` messages we sent, oldest first. */
function sentFinishes(_converse) {
    return _converse.api.connection
        .get()
        .sent_stanzas.filter((s) => s.nodeName === 'message' && sizzle(`finish[xmlns="${JMI}"]`, s).length);
}

/**
 * Assert that we sent exactly one `<finish/>` for `sid`, to `to`, giving
 * `condition` as the reason, and after any session-terminate.
 */
function expectOneFinish(_converse, { to, sid, condition }) {
    const finishes = sentFinishes(_converse);
    expect(finishes.length).toBe(1);
    const [msg] = finishes;
    expect(msg.getAttribute('to')).toBe(to);
    expect(msg.getAttribute('type')).toBe('chat');
    expect(msg.getAttribute('id')).toBeTruthy();
    const finish = sizzle(`finish[xmlns="${JMI}"]`, msg).pop();
    expect(finish.getAttribute('id')).toBe(sid);
    expect(sizzle(`> reason[xmlns="${JINGLE}"] > ${condition}`, finish).length).toBe(1);
    expect(sizzle('> store[xmlns="urn:xmpp:hints"]', msg).length).toBe(1);

    const sent = _converse.api.connection.get().sent_stanzas;
    const terminate = lastJingleIq(_converse, 'session-terminate');
    if (terminate) expect(sent.indexOf(terminate)).toBeLessThan(sent.indexOf(msg));
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
    const { parseSDP, sdpToJingle } = converse.env.u.jingle;
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
        this.signalingState = 'stable';
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
        this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
        return Promise.resolve();
    }
    setRemoteDescription(desc) {
        this.remoteDescription = desc;
        this.signalingState = desc.type === 'offer' ? 'have-remote-offer' : 'stable';
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
        'uses a WebRTC implementation installed after Converse loaded',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            installFakeWebRTC();
            webrtc.RTCPeerConnection = saved.RTCPeerConnection; // no override
            // As a polyfill under Node.js would be
            const created = [];
            vi.stubGlobal('RTCPeerConnection', function (config) {
                const pc = new FakePeerConnection(config);
                created.push(pc);
                return pc;
            });
            try {
                const jid = await getContactJid(_converse);
                const call = _converse.api.calls.dial(jid);
                receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);
                await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
                expect(created.length).toBe(1);
            } finally {
                vi.unstubAllGlobals();
            }
        }),
    );

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
        'connects through the configured and the discovered ICE servers',
        mock.initConverse(
            converse,
            ['rosterInitialized', 'callsInitialized'],
            { call_ice_servers: [{ urls: 'stun:configured.example.org:3478' }] },
            async (_converse) => {
                const webrtc_handle = installFakeWebRTC();
                const jid = await getContactJid(_converse);
                _converse.state.ice_servers = { servers: [{ urls: 'stun:discovered.montague.lit:3478' }], expires_at: null };
                const call = _converse.api.calls.dial(jid);

                receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);
                await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

                expect(webrtc_handle.pc.config.iceServers).toEqual([
                    { urls: 'stun:configured.example.org:3478' },
                    { urls: 'stun:discovered.montague.lit:3478' },
                ]);
            },
        ),
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
        'mutes and unmutes the microphone',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const stream = fakeStream();
            installFakeWebRTC({ getUserMedia: () => Promise.resolve(stream) });
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);
            await u.waitUntil(() => call.local_stream);
            const [track] = stream.getAudioTracks();

            call.toggleAudio();
            expect(call.get('muted_audio')).toBe(true);
            expect(track.enabled).toBe(false);

            call.toggleAudio();
            expect(call.get('muted_audio')).toBe(false);
            expect(track.enabled).toBe(true);
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
            const { parseSDP, sdpToJingle } = converse.env.u.jingle;

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

    describe('that never connects', function () {
        afterEach(() => vi.useRealTimers());

        it(
            'fails half a minute after the callee <proceed>s',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                installFakeWebRTC();
                const jid = await getContactJid(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                const call = _converse.api.calls.dial(jid);
                const sid = call.get('id');

                receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
                await vi.advanceTimersByTimeAsync(29_999);
                expect(lastJingleIq(_converse, 'session-initiate')).toBeDefined();
                expect(call.get('state')).toBe('connecting');

                await vi.advanceTimersByTimeAsync(1);
                expect(call.get('state')).toBe('failed');
                expect(call.get('ended_reason')).toBe('connectivity-error');
                const terminate = lastJingleIq(_converse, 'session-terminate');
                expect(terminate.getAttribute('to')).toBe(`${jid}/phone`);
                expect(sizzle('reason > connectivity-error', terminate).length).toBe(1);
            }),
        );

        it(
            "fails half a minute after we accept when the caller's session-initiate never comes",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                installFakeWebRTC();
                const jid = await getContactJid(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<propose xmlns="${JMI}" id="in-late"><description xmlns="${RTP}" media="audio"/></propose>`,
                );
                const call = _converse.state.calls.get('in-late');
                call.accept();

                await vi.advanceTimersByTimeAsync(30_000);
                expect(call.get('state')).toBe('failed');
                expect(call.get('ended_reason')).toBe('connectivity-error');
                const terminate = lastJingleIq(_converse, 'session-terminate');
                expect(terminate.getAttribute('to')).toBe(`${jid}/phone`);
                expect(sizzle('reason > connectivity-error', terminate).length).toBe(1);
            }),
        );

        it(
            'stays up once connected',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const webrtc_handle = installFakeWebRTC();
                const jid = await getContactJid(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                const call = _converse.api.calls.dial(jid);

                receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);
                await vi.advanceTimersByTimeAsync(10_000);
                webrtc_handle.pc.connectionState = 'connected';
                webrtc_handle.pc.onconnectionstatechange();
                expect(call.get('state')).toBe('active');

                await vi.advanceTimersByTimeAsync(120_000);
                expect(call.get('state')).toBe('active');
            }),
        );
    });

    describe('that loses connectivity once connected', function () {
        afterEach(() => vi.useRealTimers());

        // Our offer and answer after an ICE restart: same session, new credentials.
        const RESTART_OFFER_SDP = OFFER_SDP.replace('ice-ufrag:abc', 'ice-ufrag:ours2').replace(
            'ice-pwd:thispasswordisatleast22chars',
            'ice-pwd:ourrestartedpassword22chars',
        );
        const RESTART_ANSWER_SDP = OFFER_SDP.replace('ice-ufrag:abc', 'ice-ufrag:ours3')
            .replace('ice-pwd:thispasswordisatleast22chars', 'ice-pwd:ouransweredpassword22chars')
            .replace('a=setup:actpass', 'a=setup:active');

        const LOCAL_CANDIDATE = { candidate: 'candidate:1 1 udp 2113937151 192.0.2.1 10000 typ host', sdpMid: '0' };

        /** A transport-info from the peer with new ICE credentials, and optionally a candidate. */
        function peerRestart(sid, with_candidate = false) {
            return stx`
                <jingle xmlns="${JINGLE}" action="transport-info" sid="${sid}">
                    <content xmlns="${JINGLE}" creator="initiator" name="0">
                        <transport xmlns="urn:xmpp:jingle:transports:ice-udp:1" ufrag="theirs2"
                                   pwd="theirrestartedpassword22">
                            ${
                                with_candidate
                                    ? stx`<candidate component="1" foundation="1" generation="1" id="r1"
                                            ip="192.0.2.7" network="0" port="30000" priority="2113937151"
                                            protocol="udp" type="host"/>`
                                    : ''
                            }
                        </transport>
                    </content>
                </jingle>`;
        }

        function iqResponse(_converse, from, iq, error = '') {
            const response = stx`
                <iq xmlns="jabber:client" type="${error ? 'error' : 'result'}" from="${from}"
                    to="${_converse.session.get('jid')}" id="${iq.getAttribute('id')}">${error}</iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, response));
        }

        function transportInfos(_converse) {
            return _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => sizzle(`jingle[action="transport-info"]`, s).length);
        }

        function connect(pc) {
            pc.connectionState = 'connected';
            pc.onconnectionstatechange();
        }

        function failConnection(pc) {
            pc.connectionState = 'failed';
            pc.onconnectionstatechange();
        }

        /** Dial a contact and connect, with the callee as the DTLS server. */
        async function startOutgoingCall(_converse) {
            const webrtc_handle = installFakeWebRTC({
                pcOverrides: {
                    createOffer(options) {
                        this.offer_options = options;
                        const sdp = options?.iceRestart ? RESTART_OFFER_SDP : OFFER_SDP;
                        return Promise.resolve({ type: 'offer', sdp });
                    },
                },
            });
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');
            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));

            const { parseSDP, sdpToJingle } = converse.env.u.jingle;
            const answer = parseSDP(OFFER_SDP.replace('a=setup:actpass', 'a=setup:passive'));
            receiveIq(
                _converse,
                `${jid}/phone`,
                'accept-iq',
                sdpToJingle(answer, { action: 'session-accept', sid, is_initiator: false }),
            );
            const pc = webrtc_handle.pc;
            await u.waitUntil(() => pc.remoteDescription);
            connect(pc);
            return { pc, call, jid, sid };
        }

        /** Answer a call from a contact and connect. */
        async function startIncomingCall(_converse) {
            const webrtc_handle = installFakeWebRTC({
                pcOverrides: {
                    createOffer: () => Promise.resolve({ type: 'offer', sdp: RESTART_OFFER_SDP }),
                },
            });
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="in-restart"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('in-restart');
            call.accept();
            receiveIq(_converse, `${jid}/phone`, 'initiate-iq', jingle('session-initiate', 'in-restart'));
            await u.waitUntil(() => lastJingleIq(_converse, 'session-accept'));
            const pc = webrtc_handle.pc;
            connect(pc);
            return { pc, call, jid, sid: 'in-restart' };
        }

        it(
            'restarts ICE instead of ending the call',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, call } = await startOutgoingCall(_converse);

                failConnection(pc);

                const restart = await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));
                expect(pc.offer_options).toEqual({ iceRestart: true });
                const transport = sizzle('content[name="0"] > transport', restart).pop();
                expect(transport.getAttribute('ufrag')).toBe('ours2');
                expect(transport.getAttribute('pwd')).toBe('ourrestartedpassword22chars');
                // No candidates: that's what marks it as an offer to restart.
                expect(sizzle('candidate', restart).length).toBe(0);
                expect(call.get('state')).toBe('active');
                expect(lastJingleIq(_converse, 'session-terminate')).toBeUndefined();
            }),
        );

        it(
            'sends its new candidates only once the peer acks the restart',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, jid } = await startOutgoingCall(_converse);
                failConnection(pc);
                const restart = await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));

                pc.onicecandidate({ candidate: LOCAL_CANDIDATE });
                expect(transportInfos(_converse).length).toBe(1);

                iqResponse(_converse, `${jid}/phone`, restart);
                const trickled = await u.waitUntil(() => transportInfos(_converse)[1]);
                expect(sizzle('candidate', trickled).pop().getAttribute('ip')).toBe('192.0.2.1');
                expect(sizzle('transport', trickled).pop().getAttribute('ufrag')).toBe('ours2');
            }),
        );

        it(
            'applies the new credentials the peer answers with',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, jid, sid } = await startOutgoingCall(_converse);
                failConnection(pc);
                const restart = await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));
                iqResponse(_converse, `${jid}/phone`, restart);

                receiveIq(_converse, `${jid}/phone`, 'answer-iq', peerRestart(sid, true));

                expect(sentIq(_converse, 'result', 'answer-iq')).toBeDefined();
                await u.waitUntil(() => pc.remoteDescription.sdp.includes('a=ice-ufrag:theirs2'));
                const sdp = pc.remoteDescription.sdp;
                expect(pc.remoteDescription.type).toBe('answer');
                expect(sdp).toContain('a=ice-pwd:theirrestartedpassword22');
                // The DTLS roles stay as they were negotiated.
                expect(sdp).toContain('a=setup:passive');
                expect(pc.signalingState).toBe('stable');
                await u.waitUntil(() => pc.candidates.length);
                expect(pc.candidates[0].candidate).toContain('192.0.2.7 30000');
            }),
        );

        it(
            'ends the call when the restarted connection fails too',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, call } = await startOutgoingCall(_converse);
                failConnection(pc);
                await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));

                failConnection(pc);

                expect(call.get('state')).toBe('failed');
                expect(call.get('ended_reason')).toBe('connectivity-error');
                const terminate = lastJingleIq(_converse, 'session-terminate');
                expect(sizzle('reason > connectivity-error', terminate).length).toBe(1);
            }),
        );

        it(
            'ends the call when the peer acks the restart but never answers it',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, call, jid } = await startOutgoingCall(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                failConnection(pc);
                await vi.advanceTimersByTimeAsync(0);
                iqResponse(_converse, `${jid}/phone`, lastJingleIq(_converse, 'transport-info'));

                await vi.advanceTimersByTimeAsync(29_999);
                expect(call.get('state')).toBe('active');

                await vi.advanceTimersByTimeAsync(1);
                expect(call.get('state')).toBe('failed');
                expect(call.get('ended_reason')).toBe('connectivity-error');
                expect(lastJingleIq(_converse, 'session-terminate')).toBeDefined();
            }),
        );

        it(
            'stays up once the restarted connection connects',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, call } = await startOutgoingCall(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                failConnection(pc);
                await vi.advanceTimersByTimeAsync(10_000);

                connect(pc);
                await vi.advanceTimersByTimeAsync(120_000);
                expect(call.get('state')).toBe('active');

                // And it may restart again later.
                failConnection(pc);
                expect(call.get('state')).toBe('active');
            }),
        );

        it(
            "answers the peer's restart",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, jid, sid } = await startOutgoingCall(_converse);
                pc.createAnswer = () => Promise.resolve({ type: 'answer', sdp: RESTART_ANSWER_SDP });

                receiveIq(_converse, `${jid}/phone`, 'restart-iq', peerRestart(sid));

                expect(sentIq(_converse, 'result', 'restart-iq')).toBeDefined();
                await u.waitUntil(() => pc.localDescription.type === 'answer');
                expect(pc.remoteDescription.type).toBe('offer');
                expect(pc.remoteDescription.sdp).toContain('a=ice-ufrag:theirs2');
                expect(pc.remoteDescription.sdp).toContain('a=setup:actpass');

                // Our candidates carry the answer's credentials, which tells the peer our answer.
                pc.onicecandidate({ candidate: LOCAL_CANDIDATE });
                const trickled = await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));
                expect(sizzle('transport', trickled).pop().getAttribute('ufrag')).toBe('ours3');
            }),
        );

        it(
            "refuses the responder's restart with a tie-break when both restart at once",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, jid, sid } = await startOutgoingCall(_converse);
                failConnection(pc);
                await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));

                receiveIq(_converse, `${jid}/phone`, 'glare-iq', peerRestart(sid));

                const error = sentIq(_converse, 'error', 'glare-iq');
                expect(sizzle('conflict', error).length).toBe(1);
                expect(sizzle(`tie-break[xmlns="${JINGLE_ERRORS}"]`, error).length).toBe(1);
                expect(pc.remoteDescription.sdp).not.toContain('theirs2');
            }),
        );

        it(
            "yields to the initiator's restart when both restart at once",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { pc, call, jid, sid } = await startIncomingCall(_converse);
                failConnection(pc);
                const ours = await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));

                receiveIq(_converse, `${jid}/phone`, 'glare-iq', peerRestart(sid));
                expect(sentIq(_converse, 'result', 'glare-iq')).toBeDefined();
                await u.waitUntil(() => pc.remoteDescription.sdp.includes('a=ice-ufrag:theirs2'));
                expect(pc.remoteDescription.type).toBe('offer');
                await u.waitUntil(() => pc.localDescription.type === 'answer');

                iqResponse(
                    _converse,
                    `${jid}/phone`,
                    ours,
                    stx`<error type="cancel">
                        <conflict xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        <tie-break xmlns="${JINGLE_ERRORS}"/>
                    </error>`,
                );
                await new Promise((resolve) => setTimeout(resolve)); // let the error handler run
                expect(call.get('state')).toBe('active');
                expect(lastJingleIq(_converse, 'session-terminate')).toBeUndefined();
            }),
        );
    });

    describe('trickling ICE candidates', function () {
        // Two m-lines with their own ICE credentials, as with BUNDLE disabled.
        const TWO_MEDIA_SDP =
            OFFER_SDP +
            'm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' +
            'c=IN IP4 0.0.0.0\r\n' +
            'a=mid:1\r\n' +
            'a=sendrecv\r\n' +
            'a=ice-ufrag:second\r\n' +
            'a=ice-pwd:secondpasswordatleast22chars\r\n' +
            'a=rtpmap:111 opus/48000/2\r\n';

        async function startCall(_converse, pcOverrides) {
            const webrtc_handle = installFakeWebRTC({ pcOverrides });
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
            return { webrtc_handle, jid, sid: call.get('id') };
        }

        it(
            "sends a candidate with its own m-line's ICE credentials",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { webrtc_handle } = await startCall(_converse, {
                    createOffer: () => Promise.resolve({ type: 'offer', sdp: TWO_MEDIA_SDP }),
                });

                webrtc_handle.pc.onicecandidate({
                    candidate: { candidate: 'candidate:1 1 udp 2113937151 192.0.2.1 10000 typ host', sdpMid: '1' },
                });

                const ti = await u.waitUntil(() => lastJingleIq(_converse, 'transport-info'));
                const transport = sizzle('content[name="1"] > transport', ti).pop();
                expect(transport.getAttribute('ufrag')).toBe('second');
                expect(transport.getAttribute('pwd')).toBe('secondpasswordatleast22chars');
            }),
        );

        it(
            'does not send a TCP candidate',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { webrtc_handle } = await startCall(_converse);

                webrtc_handle.pc.onicecandidate({
                    candidate: {
                        candidate: 'candidate:2 1 tcp 1518280447 192.0.2.1 9 typ host tcptype active',
                        sdpMid: '0',
                    },
                });

                expect(lastJingleIq(_converse, 'transport-info')).toBeUndefined();
            }),
        );

        it(
            'does not apply a TCP candidate from the peer',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { webrtc_handle, jid, sid } = await startCall(_converse);
                receiveIq(_converse, `${jid}/phone`, 'accept-iq', jingle('session-accept', sid));
                await u.waitUntil(() => webrtc_handle.pc.remoteDescription);

                const ti = stx`
                    <jingle xmlns="${JINGLE}" action="transport-info" sid="${sid}">
                        <content xmlns="${JINGLE}" creator="initiator" name="0">
                            <transport
                                xmlns="urn:xmpp:jingle:transports:ice-udp:1" ufrag="abc"
                                pwd="thispasswordisatleast22chars">
                                <candidate
                                    component="1" foundation="2" generation="0" id="c1" ip="192.0.2.9"
                                    network="0" port="9" priority="1518280447" protocol="tcp" type="host"/>
                            </transport>
                        </content>
                    </jingle>`;
                receiveIq(_converse, `${jid}/phone`, 'ti-iq', ti);

                expect(sentIq(_converse, 'result', 'ti-iq')).toBeDefined();
                expect(webrtc_handle.pc.candidates).toEqual([]);
            }),
        );
    });

    describe('when setting up the session fails for a reason other than the microphone', function () {
        it(
            'fails an outgoing call as an application failure',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                installFakeWebRTC({ pcOverrides: { createOffer: () => Promise.reject(new Error('no offer')) } });
                const jid = await getContactJid(_converse);
                const call = _converse.api.calls.dial(jid);

                receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);

                await u.waitUntil(() => call.get('state') === 'failed');
                expect(call.get('ended_reason')).toBe('failed-application');
                const term = lastJingleIq(_converse, 'session-terminate');
                expect(sizzle('reason > failed-application', term).length).toBe(1);
            }),
        );

        it(
            "fails an incoming call whose offer can't be applied as an application failure",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const gum = vi.fn(() => Promise.resolve(fakeStream()));
                installFakeWebRTC({
                    getUserMedia: gum,
                    pcOverrides: { setRemoteDescription: () => Promise.reject(new Error('bad sdp')) },
                });
                const jid = await getContactJid(_converse);
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<propose xmlns="${JMI}" id="in-bad"><description xmlns="${RTP}" media="audio"/></propose>`,
                );
                const call = _converse.state.calls.get('in-bad');
                call.accept();

                receiveIq(_converse, `${jid}/phone`, 'init-iq', jingle('session-initiate', 'in-bad'));

                await u.waitUntil(() => call.get('state') === 'failed');
                expect(call.get('ended_reason')).toBe('failed-application');
                const term = lastJingleIq(_converse, 'session-terminate');
                expect(sizzle('reason > failed-application', term).length).toBe(1);
                expect(gum).not.toHaveBeenCalled();
            }),
        );
    });

    describe('with a Jingle action we do not implement', function () {
        async function startSession(_converse) {
            installFakeWebRTC();
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');
            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
            receiveIq(_converse, `${jid}/phone`, 'accept-iq', jingle('session-accept', sid));
            return { jid, sid, call };
        }

        /** The error a sent IQ carries, as [xmpp condition, jingle condition]. */
        function errorOf(iq) {
            const error = sizzle('error', iq).pop();
            return [
                sizzle('[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', error).pop()?.tagName,
                sizzle(`[xmlns="${JINGLE_ERRORS}"]`, error).pop()?.tagName,
            ];
        }

        it(
            'acks a session-info that is empty or carries an RTP info payload',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, sid } = await startSession(_converse);

                receiveIq(_converse, `${jid}/phone`, 'ping-iq', stx`<jingle xmlns="${JINGLE}" action="session-info" sid="${sid}"/>`);
                receiveIq(
                    _converse,
                    `${jid}/phone`,
                    'mute-iq',
                    stx`<jingle xmlns="${JINGLE}" action="session-info" sid="${sid}">
                        <mute xmlns="urn:xmpp:jingle:apps:rtp:info:1" creator="initiator" name="0"/>
                    </jingle>`,
                );

                expect(sentIq(_converse, 'result', 'ping-iq')).toBeDefined();
                expect(sentIq(_converse, 'result', 'mute-iq')).toBeDefined();
            }),
        );

        it(
            "refuses a session-info whose payload it doesn't understand",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, sid } = await startSession(_converse);

                receiveIq(
                    _converse,
                    `${jid}/phone`,
                    'info-iq',
                    stx`<jingle xmlns="${JINGLE}" action="session-info" sid="${sid}">
                        <hold xmlns="urn:x:other"/>
                    </jingle>`,
                );

                expect(errorOf(sentIq(_converse, 'error', 'info-iq'))).toEqual([
                    'feature-not-implemented',
                    'unsupported-info',
                ]);
            }),
        );

        it(
            'rejects added content, such as video',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, sid, call } = await startSession(_converse);

                receiveIq(
                    _converse,
                    `${jid}/phone`,
                    'add-iq',
                    stx`<jingle xmlns="${JINGLE}" action="content-add" sid="${sid}">
                        <content creator="responder" name="video" senders="both">
                            <description xmlns="${RTP}" media="video"/>
                        </content>
                    </jingle>`,
                );

                expect(sentIq(_converse, 'result', 'add-iq')).toBeDefined();
                const reject = lastJingleIq(_converse, 'content-reject');
                expect(reject.getAttribute('to')).toBe(`${jid}/phone`);
                const content = sizzle('content', reject).pop();
                expect(content.getAttribute('name')).toBe('video');
                expect(content.getAttribute('creator')).toBe('responder');
                expect(call.get('state')).not.toBe('failed');
            }),
        );

        it(
            'rejects a replacement transport',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, sid } = await startSession(_converse);

                receiveIq(
                    _converse,
                    `${jid}/phone`,
                    'replace-iq',
                    stx`<jingle xmlns="${JINGLE}" action="transport-replace" sid="${sid}">
                        <content creator="initiator" name="0">
                            <transport xmlns="urn:xmpp:jingle:transports:s5b:1"/>
                        </content>
                    </jingle>`,
                );

                expect(sentIq(_converse, 'result', 'replace-iq')).toBeDefined();
                const reject = lastJingleIq(_converse, 'transport-reject');
                expect(sizzle('content', reject).pop().getAttribute('name')).toBe('0');
            }),
        );

        it(
            'answers any other one with feature-not-implemented',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, sid } = await startSession(_converse);

                receiveIq(
                    _converse,
                    `${jid}/phone`,
                    'modify-iq',
                    stx`<jingle xmlns="${JINGLE}" action="content-modify" sid="${sid}">
                        <content creator="initiator" name="0" senders="initiator"/>
                    </jingle>`,
                );

                expect(sentIq(_converse, 'result', 'modify-iq')).toBeUndefined();
                expect(errorOf(sentIq(_converse, 'error', 'modify-iq'))).toEqual([
                    'feature-not-implemented',
                    undefined,
                ]);
            }),
        );
    });

    describe('that ends after the call was answered', function () {
        afterEach(() => vi.useRealTimers());

        /** Dial a contact, have them proceed, and connect. */
        async function connectedCall(_converse, { stream } = {}) {
            const webrtc_handle = installFakeWebRTC(stream ? { getUserMedia: () => Promise.resolve(stream) } : {});
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');
            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            await u.waitUntil(() => lastJingleIq(_converse, 'session-initiate'));
            receiveIq(_converse, `${jid}/phone`, 'accept-iq', jingle('session-accept', sid));
            webrtc_handle.pc.connectionState = 'connected';
            webrtc_handle.pc.onconnectionstatechange();
            expect(call.get('state')).toBe('active');
            return { jid, sid, call, pc: webrtc_handle.pc };
        }

        it(
            "sends a <finish/> to the peer's full JID when we hang up",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, sid, call } = await connectedCall(_converse);
                call.hangup();
                expectOneFinish(_converse, { to: `${jid}/phone`, sid, condition: 'success' });
            }),
        );

        it(
            'sends its own <finish/> when the peer hangs up',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, sid, call } = await connectedCall(_converse);
                const term = stx`
                    <jingle xmlns="${JINGLE}" action="session-terminate" sid="${sid}">
                        <reason><success/></reason>
                    </jingle>`;
                receiveIq(_converse, `${jid}/phone`, 'term-iq', term);

                expect(call.get('state')).toBe('ended');
                expectOneFinish(_converse, { to: `${jid}/phone`, sid, condition: 'success' });
            }),
        );

        it(
            'sends one <finish/> however many ways the call ends',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, sid, call } = await connectedCall(_converse);
                call.hangup();
                // The peer hung up at the same time.
                const term = stx`
                    <jingle xmlns="${JINGLE}" action="session-terminate" sid="${sid}">
                        <reason><success/></reason>
                    </jingle>`;
                receiveIq(_converse, `${jid}/phone`, 'term-iq', term);
                call.hangup();

                expect(sentFinishes(_converse).length).toBe(1);
            }),
        );

        it(
            'sends a <finish/> with a connectivity error when the call never connects',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                installFakeWebRTC();
                const jid = await getContactJid(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                const call = _converse.api.calls.dial(jid);
                const sid = call.get('id');
                receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);

                await vi.advanceTimersByTimeAsync(30_000);
                expect(call.get('state')).toBe('failed');
                expectOneFinish(_converse, { to: `${jid}/phone`, sid, condition: 'connectivity-error' });
            }),
        );

        it(
            "sends a <finish/> with a media error when the microphone can't be opened",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                installFakeWebRTC({ getUserMedia: () => Promise.reject(new Error('NotAllowedError')) });
                const jid = await getContactJid(_converse);
                const call = _converse.api.calls.dial(jid);
                const sid = call.get('id');
                receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);

                await u.waitUntil(() => call.get('state') === 'failed');
                expectOneFinish(_converse, { to: `${jid}/phone`, sid, condition: 'media-error' });
            }),
        );

        it(
            'sends a <finish/> when we hang up an accepted call before its session starts',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                installFakeWebRTC();
                const jid = await getContactJid(_converse);
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<propose xmlns="${JMI}" id="in-fin"><description xmlns="${RTP}" media="audio"/></propose>`,
                );
                const call = _converse.state.calls.get('in-fin');
                call.accept();
                call.hangup();

                expect(lastJingleIq(_converse, 'session-terminate')).toBeDefined();
                expectOneFinish(_converse, { to: `${jid}/phone`, sid: 'in-fin', condition: 'cancel' });
            }),
        );

        it(
            'ends a connected call when the peer sends a <finish/>, without a session-terminate of ours',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const stream = fakeStream();
                const stop = vi.spyOn(stream.getTracks()[0], 'stop');
                const { jid, sid, call, pc } = await connectedCall(_converse, { stream });

                // The peer lost power mid-call, and its <finish/> reaches us once it is back.
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<finish xmlns="${JMI}" id="${sid}"><reason xmlns="${JINGLE}"><success/></reason></finish>`,
                );

                expect(call.get('state')).toBe('ended');
                expect(call.get('ended_reason')).toBe('success');
                expect(pc.closed).toBe(true);
                expect(stop).toHaveBeenCalled();
                expect(lastJingleIq(_converse, 'session-terminate')).toBeUndefined();
                expectOneFinish(_converse, { to: `${jid}/phone`, sid, condition: 'success' });
            }),
        );
    });
});
