import converse from '../../shared/api/public.js';
import {
    directionToSenders,
    jingleToSDP,
    parseSDP,
    sdpToJingle,
    sendersToDirection,
    writeSDP,
} from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('JINGLE', 'urn:xmpp:jingle:1');
Strophe.addNamespace('JINGLE_RTP', 'urn:xmpp:jingle:apps:rtp:1');
Strophe.addNamespace('JINGLE_RTP_HDREXT', 'urn:xmpp:jingle:apps:rtp:rtp-hdrext:0');
Strophe.addNamespace('JINGLE_RTP_FB', 'urn:xmpp:jingle:apps:rtp:rtcp-fb:0');
Strophe.addNamespace('JINGLE_RTP_SSMA', 'urn:xmpp:jingle:apps:rtp:ssma:0');
Strophe.addNamespace('JINGLE_ICE', 'urn:xmpp:jingle:transports:ice-udp:1');
Strophe.addNamespace('JINGLE_DTLS', 'urn:xmpp:jingle:apps:dtls:0');
Strophe.addNamespace('JINGLE_GROUPING', 'urn:xmpp:jingle:apps:grouping:0');

converse.env.jingle = { directionToSenders, jingleToSDP, parseSDP, sdpToJingle, sendersToDirection, writeSDP };

converse.plugins.add('converse-jingle', {});
