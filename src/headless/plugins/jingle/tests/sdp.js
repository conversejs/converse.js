import converse from '../../../dist/converse-headless.js';

const { sizzle } = converse.env;
const { directionToSenders, jingleToSDP, parseSDP, sdpToJingle, sendersToDirection } = converse.env.jingle;

const sample_sdp =
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
    'a=rtpmap:111 opus/48000/2\r\n' +
    'a=fmtp:111 minptime=10;useinbandfec=1\r\n' +
    'a=rtcp-fb:111 transport-cc\r\n' +
    'a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n' +
    'a=ssrc:12345 cname:abcdef\r\n' +
    'a=ssrc:12345 msid:stream track\r\n' +
    'a=candidate:1 1 udp 2113937151 192.0.2.1 10000 typ host generation 0\r\n';

describe('Jingle/SDP conversion', function () {
    it('builds a Jingle session from an SDP offer', function () {
        const jingle = sdpToJingle(parseSDP(sample_sdp), {
            is_initiator: true,
            sid: 'abc123',
            action: 'session-initiate',
        }).tree();

        expect(jingle.getAttribute('action')).toBe('session-initiate');
        expect(jingle.getAttribute('sid')).toBe('abc123');

        const contents = sizzle('> content', jingle);
        expect(contents.length).toBe(1);
        expect(contents[0].getAttribute('name')).toBe('0');
        expect(contents[0].getAttribute('senders')).toBe('both');

        const description = sizzle('description', contents[0]).pop();
        expect(description.getAttribute('media')).toBe('audio');

        const payload = sizzle('payload-type', description).pop();
        expect(payload.getAttribute('id')).toBe('111');
        expect(payload.getAttribute('name')).toBe('opus');
        expect(payload.getAttribute('clockrate')).toBe('48000');
        expect(payload.getAttribute('channels')).toBe('2');

        const params = sizzle('parameter', payload).map((p) => [p.getAttribute('name'), p.getAttribute('value')]);
        expect(params).toEqual([
            ['minptime', '10'],
            ['useinbandfec', '1'],
        ]);

        expect(sizzle('rtcp-fb[type="transport-cc"]', payload).length).toBe(1);
        expect(sizzle('rtp-hdrext', description).pop().getAttribute('uri')).toBe(
            'urn:ietf:params:rtp-hdrext:ssrc-audio-level'
        );
        expect(sizzle('rtcp-mux', description).length).toBe(1);

        const fingerprint = sizzle('transport fingerprint', jingle).pop();
        expect(fingerprint.getAttribute('hash')).toBe('sha-256');
        expect(fingerprint.getAttribute('setup')).toBe('actpass');

        const candidate = sizzle('transport candidate', jingle).pop();
        expect(candidate.getAttribute('ip')).toBe('192.0.2.1');
        expect(candidate.getAttribute('protocol')).toBe('udp');
        expect(candidate.getAttribute('type')).toBe('host');
    });

    it('preserves the BUNDLE group', function () {
        const jingle = sdpToJingle(parseSDP(sample_sdp), { is_initiator: true }).tree();
        const group = sizzle('group', jingle).pop();
        expect(group.getAttribute('semantics')).toBe('BUNDLE');
        expect(sizzle('content', group).map((c) => c.getAttribute('name'))).toEqual(['0']);
    });

    it('roundtrips offer fields through SDP -> Jingle -> SDP', function () {
        const opts = { is_initiator: true };
        const jingle = sdpToJingle(parseSDP(sample_sdp), opts).tree();
        const sdp = jingleToSDP(jingle, opts);

        expect(sdp.media.length).toBe(1);
        const m = sdp.media[0];
        expect(m.mid).toBe('0');
        expect(m.iceUfrag).toBe('abc');
        expect(m.icePwd).toBe('thispasswordisatleast22chars');
        expect(m.direction).toBe('sendrecv');
        expect(m.rtp).toEqual([{ payload: 111, codec: 'opus', rate: 48000, encoding: 2 }]);
        expect(m.fmtp).toEqual([{ payload: 111, config: 'minptime=10;useinbandfec=1' }]);
        expect(m.setup).toBe('actpass');
        expect(m.candidates.length).toBe(1);
        expect(sdp.groups).toEqual([{ type: 'BUNDLE', mids: '0' }]);
    });

    it('maps senders and direction relative to the initiator role', function () {
        expect(directionToSenders('sendonly', true)).toBe('initiator');
        expect(directionToSenders('sendonly', false)).toBe('responder');
        expect(directionToSenders('recvonly', true)).toBe('responder');

        expect(sendersToDirection('initiator', true)).toBe('sendonly');
        expect(sendersToDirection('initiator', false)).toBe('recvonly');
    });
});
