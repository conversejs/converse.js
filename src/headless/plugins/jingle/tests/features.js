import { vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { u } = converse.env;

// What other clients look for before offering to call us (Conversations: RtpCapability.java).
const CALL_FEATURES = [
    'urn:xmpp:jingle:1',
    'urn:xmpp:jingle:apps:rtp:1',
    'urn:xmpp:jingle:apps:rtp:audio',
    'urn:xmpp:jingle:transports:ice-udp:1',
    'urn:xmpp:jingle:apps:dtls:0',
    'urn:xmpp:jingle-message:0',
];

// The RTP extensions we translate between SDP and Jingle.
const EXTENSION_FEATURES = [
    'urn:xmpp:jingle:apps:grouping:0',
    'urn:xmpp:jingle:apps:rtp:rtcp-fb:0',
    'urn:xmpp:jingle:apps:rtp:rtp-hdrext:0',
    'urn:xmpp:jingle:apps:rtp:ssma:0',
];

describe('Audio calls', function () {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it(
        'are advertised in our disco features',
        mock.initConverse(converse, ['discoInitialized'], {}, async (_converse) => {
            const features = await u.waitUntil(() => _converse.api.disco.own.features.get());
            expect(features).toEqual(expect.arrayContaining([...CALL_FEATURES, ...EXTENSION_FEATURES]));
            expect(features).not.toContain('urn:xmpp:jingle:apps:rtp:video');
        }),
    );

    describe('without WebRTC', function () {
        // As under Node.js
        beforeEach(() => {
            vi.stubGlobal('RTCPeerConnection', undefined);
        });

        it(
            'are not advertised',
            mock.initConverse(converse, ['discoInitialized'], {}, async (_converse) => {
                const features = await u.waitUntil(() => _converse.api.disco.own.features.get());
                [...CALL_FEATURES, ...EXTENSION_FEATURES].forEach((f) => expect(features).not.toContain(f));
            }),
        );
    });
});
