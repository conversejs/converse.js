import { parse, write } from 'sdp-transform';
import converse from '../../shared/api/public.js';

/**
 * @typedef {import('./types').SessionDescription} SessionDescription
 * @typedef {import('./types').MediaDescription} MediaDescription
 * @typedef {import('./types').JingleSenders} JingleSenders
 * @typedef {import('./types').SdpDirection} SdpDirection
 * @typedef {import('./types').SdpCandidate} SdpCandidate
 * @typedef {import('./types').JingleConversionOptions} JingleConversionOptions
 */

const { Stanza, Strophe, sizzle, stx, u } = converse.env;

const MEDIA_PROTOCOL = 'UDP/TLS/RTP/SAVPF';
const MEDIA_PORT = 9;

/**
 * @param {string} sdp
 * @returns {SessionDescription}
 */
export function parseSDP(sdp) {
    return /** @type {SessionDescription} */ (parse(sdp));
}

/**
 * @param {SessionDescription} sdp
 * @returns {string}
 */
export function writeSDP(sdp) {
    return write(sdp);
}

/**
 * @param {SdpDirection} direction
 * @param {boolean} is_initiator
 * @returns {JingleSenders}
 */
export function directionToSenders(direction, is_initiator) {
    switch (direction) {
        case 'sendrecv':
            return 'both';
        case 'inactive':
            return 'none';
        case 'sendonly':
            return is_initiator ? 'initiator' : 'responder';
        case 'recvonly':
            return is_initiator ? 'responder' : 'initiator';
        default:
            return 'both';
    }
}

/**
 * @param {JingleSenders} senders
 * @param {boolean} is_initiator
 * @returns {SdpDirection}
 */
export function sendersToDirection(senders, is_initiator) {
    switch (senders) {
        case 'both':
            return 'sendrecv';
        case 'none':
            return 'inactive';
        case 'initiator':
            return is_initiator ? 'sendonly' : 'recvonly';
        case 'responder':
            return is_initiator ? 'recvonly' : 'sendonly';
        default:
            return 'sendrecv';
    }
}

/**
 * @param {string} config
 * @returns {{ name: string, value: string }[]}
 */
function parseFmtpConfig(config) {
    return config
        .split(';')
        .map((p) => p.trim())
        .filter((p) => p)
        .map((p) => {
            const i = p.indexOf('=');
            return i === -1 ? { name: '', value: p } : { name: p.slice(0, i), value: p.slice(i + 1) };
        });
}

/**
 * @param {SdpCandidate} candidate
 * @returns {Element}
 */
export function candidateToElement(candidate) {
    return stx`
        <candidate
            component="${candidate.component}"
            foundation="${candidate.foundation}"
            generation="${candidate.generation ?? 0}"
            id="${u.getUniqueId()}"
            ip="${candidate.ip}"
            network="0"
            port="${candidate.port}"
            priority="${candidate.priority}"
            protocol="${candidate.transport}"
            ${candidate.raddr ? Stanza.unsafeXML(`rel-addr="${candidate.raddr}"`) : ''}
            ${candidate.rport !== undefined ? Stanza.unsafeXML(`rel-port="${candidate.rport}"`) : ''}
            type="${candidate.type}"/>`;
}

/**
 * Parse a browser ICE candidate line ("candidate:...") into an {@link SdpCandidate}.
 * @param {string} line
 * @returns {SdpCandidate}
 */
export function candidateFromLine(line) {
    return parse(`m=audio 9 RTP/AVP 0\r\na=${line}\r\n`).media[0].candidates[0];
}

/**
 * Format an {@link SdpCandidate} back into a browser ICE candidate line.
 * @param {SdpCandidate} c
 * @returns {string}
 */
export function candidateToLine(c) {
    let line = `candidate:${c.foundation} ${c.component} ${c.transport} ${c.priority} ${c.ip} ${c.port} typ ${c.type}`;
    if (c.raddr !== undefined) line += ` raddr ${c.raddr} rport ${c.rport}`;
    return `${line} generation ${c.generation ?? 0}`;
}

/**
 * @param {Element} el
 * @returns {SdpCandidate}
 */
export function elementToCandidate(el) {
    const candidate = /** @type {SdpCandidate} */ ({
        foundation: el.getAttribute('foundation'),
        component: Number(el.getAttribute('component')),
        transport: el.getAttribute('protocol'),
        priority: Number(el.getAttribute('priority')),
        ip: el.getAttribute('ip'),
        port: Number(el.getAttribute('port')),
        type: el.getAttribute('type'),
        generation: Number(el.getAttribute('generation') ?? 0),
    });
    const raddr = el.getAttribute('rel-addr');
    const rport = el.getAttribute('rel-port');
    if (raddr) candidate.raddr = raddr;
    if (rport) candidate.rport = Number(rport);
    return candidate;
}

/**
 * @param {MediaDescription} media
 * @returns {Element}
 */
function buildDescription(media) {
    const fmtp_by_payload = {};
    (media.fmtp ?? []).forEach((f) => (fmtp_by_payload[f.payload] = f.config));
    const fb_by_payload = {};
    (media.rtcpFb ?? []).forEach((fb) => (fb_by_payload[fb.payload] ??= []).push(fb));

    const ssrcs_by_id = {};
    (media.ssrcs ?? []).forEach((s) => (ssrcs_by_id[s.id] ??= []).push(s));

    return stx`
        <description xmlns="${Strophe.NS.JINGLE_RTP}" media="${media.type}">
            ${media.rtp.map((rtp) => {
                const fmtp = fmtp_by_payload[rtp.payload];
                const fbs = fb_by_payload[rtp.payload] ?? [];
                return stx`
                <payload-type
                    id="${rtp.payload}"
                    name="${rtp.codec}"
                    ${rtp.rate ? Stanza.unsafeXML(`clockrate="${rtp.rate}"`) : ''}
                    ${rtp.encoding && rtp.encoding > 1 ? Stanza.unsafeXML(`channels="${rtp.encoding}"`) : ''}>
                    ${fmtp ? parseFmtpConfig(fmtp).map((p) => stx`<parameter ${p.name ? Stanza.unsafeXML(`name="${p.name}"`) : ''} value="${p.value}"/>`) : ''}
                    ${fbs.map(
                        (fb) =>
                            stx`<rtcp-fb xmlns="${Strophe.NS.JINGLE_RTP_FB}" type="${fb.type}" ${fb.subtype ? Stanza.unsafeXML(`subtype="${fb.subtype}"`) : ''}/>`
                    )}
                </payload-type>`;
            })}
            ${(fb_by_payload['*'] ?? []).map(
                (fb) =>
                    stx`<rtcp-fb xmlns="${Strophe.NS.JINGLE_RTP_FB}" type="${fb.type}" ${fb.subtype ? Stanza.unsafeXML(`subtype="${fb.subtype}"`) : ''}/>`
            )}
            ${(media.ext ?? []).map(
                (e) => stx`<rtp-hdrext xmlns="${Strophe.NS.JINGLE_RTP_HDREXT}" id="${e.value}" uri="${e.uri}"/>`
            )}
            ${media.extmapAllowMixed ? stx`<extmap-allow-mixed xmlns="${Strophe.NS.JINGLE_RTP_HDREXT}"/>` : ''}
            ${(media.ssrcGroups ?? []).map(
                (g) => stx`
                <ssrc-group xmlns="${Strophe.NS.JINGLE_RTP_SSMA}" semantics="${g.semantics}">
                    ${String(g.ssrcs).split(' ').map((ssrc) => stx`<source ssrc="${ssrc}"/>`)}
                </ssrc-group>`
            )}
            ${Object.entries(ssrcs_by_id).map(
                ([id, params]) => stx`
                <source xmlns="${Strophe.NS.JINGLE_RTP_SSMA}" ssrc="${id}">
                    ${/** @type {any[]} */ (params).map(
                        (s) => stx`<parameter name="${s.attribute}" ${s.value !== undefined ? Stanza.unsafeXML(`value="${s.value}"`) : ''}/>`
                    )}
                </source>`
            )}
            ${media.rtcpMux ? stx`<rtcp-mux/>` : ''}
        </description>`;
}

/**
 * @param {MediaDescription} media
 * @param {SessionDescription} [session] - for the session-level DTLS fallback
 * @returns {Element}
 */
function buildTransport(media, session) {
    // Firefox advertises the DTLS fingerprint/setup once at the session level;
    // Chrome repeats it on every m-line. Jingle carries it per transport, so
    // fall back to the session-level value when this m-line doesn't have its own.
    const fp = media.fingerprint ?? session?.fingerprint;
    const setup = media.setup ?? session?.setup;
    const dtls = Strophe.NS.JINGLE_DTLS;
    const fingerprint = fp
        ? stx`<fingerprint xmlns="${dtls}" hash="${fp.type}" setup="${setup}">${fp.hash}</fingerprint>`
        : '';
    return stx`
        <transport xmlns="${Strophe.NS.JINGLE_ICE}" ufrag="${media.iceUfrag}" pwd="${media.icePwd}">
            ${fingerprint}
            ${(media.candidates ?? []).map((c) => candidateToElement(c))}
        </transport>`;
}

/**
 * @param {MediaDescription} media
 * @param {JingleConversionOptions} options
 * @param {SessionDescription} [session] - for the session-level DTLS fallback
 * @returns {Element}
 */
function buildContent(media, options, session) {
    const { is_initiator, creator = 'initiator' } = options;
    const direction = /** @type {SdpDirection} */ (media.direction ?? 'sendrecv');
    const senders = directionToSenders(direction, is_initiator);
    return stx`
        <content xmlns="${Strophe.NS.JINGLE}" creator="${creator}" name="${media.mid}" senders="${senders}">
            ${buildDescription(media)}
            ${buildTransport(media, session)}
        </content>`;
}

/**
 * Convert a parsed SDP offer/answer into a Jingle stanza payload.
 * @param {SessionDescription} sdp
 * @param {JingleConversionOptions} options
 * @returns {Element}
 */
export function sdpToJingle(sdp, options) {
    const { action, sid, initiator, responder } = options;
    const bundle = (sdp.groups ?? []).find((g) => g.type === 'BUNDLE');
    return stx`
        <jingle xmlns="${Strophe.NS.JINGLE}"
                ${action ? Stanza.unsafeXML(`action="${action}"`) : ''}
                ${sid ? Stanza.unsafeXML(`sid="${sid}"`) : ''}
                ${initiator ? Stanza.unsafeXML(`initiator="${initiator}"`) : ''}
                ${responder ? Stanza.unsafeXML(`responder="${responder}"`) : ''}>
            ${sdp.media.map((m) => buildContent(m, options, sdp))}
            ${
                bundle
                    ? stx`
                <group xmlns="${Strophe.NS.JINGLE_GROUPING}" semantics="BUNDLE">
                    ${String(bundle.mids).split(' ').map((mid) => stx`<content name="${mid}"/>`)}
                </group>`
                    : ''
            }
        </jingle>`;
}

/**
 * Build a Jingle transport-info `<jingle>` carrying a single trickled candidate.
 * @param {SdpCandidate} candidate
 * @param {{ sid: string, mid: string, ufrag: string, pwd: string,
 *           initiator?: string, responder?: string, creator?: 'initiator'|'responder' }} options
 * @returns {Element}
 */
export function buildTransportInfo(candidate, options) {
    const { sid, mid, ufrag, pwd, initiator, responder, creator = 'initiator' } = options;
    return stx`
        <jingle xmlns="${Strophe.NS.JINGLE}" action="transport-info" sid="${sid}"
                ${initiator ? Stanza.unsafeXML(`initiator="${initiator}"`) : ''}
                ${responder ? Stanza.unsafeXML(`responder="${responder}"`) : ''}>
            <content xmlns="${Strophe.NS.JINGLE}" creator="${creator}" name="${mid}">
                <transport xmlns="${Strophe.NS.JINGLE_ICE}" ufrag="${ufrag}" pwd="${pwd}">
                    ${candidateToElement(candidate)}
                </transport>
            </content>
        </jingle>`;
}

/**
 * @param {Element} payload
 * @returns {{ rtp: object, fmtp: object|null, rtcpFb: object[] }}
 */
function parsePayloadType(payload) {
    const id = Number(payload.getAttribute('id'));
    const rtp = { payload: id, codec: payload.getAttribute('name') };
    const clockrate = payload.getAttribute('clockrate');
    if (clockrate) rtp.rate = Number(clockrate);
    const channels = payload.getAttribute('channels');
    if (channels) rtp.encoding = Number(channels);

    const params = sizzle('parameter', payload);
    let fmtp = null;
    if (params.length) {
        const config = params
            .map((p) => {
                const name = p.getAttribute('name');
                const value = p.getAttribute('value');
                return name ? `${name}=${value}` : value;
            })
            .join(';');
        fmtp = { payload: id, config };
    }

    const rtcpFb = sizzle(`rtcp-fb[xmlns="${Strophe.NS.JINGLE_RTP_FB}"]`, payload).map((fb) => {
        const entry = { payload: id, type: fb.getAttribute('type') };
        const subtype = fb.getAttribute('subtype');
        if (subtype) entry.subtype = subtype;
        return entry;
    });

    return { rtp, fmtp, rtcpFb };
}

/**
 * @param {Element} content
 * @param {JingleConversionOptions} options
 * @returns {MediaDescription}
 */
function parseContent(content, options) {
    const description = sizzle(`description[xmlns="${Strophe.NS.JINGLE_RTP}"]`, content).pop();
    const transport = sizzle(`transport[xmlns="${Strophe.NS.JINGLE_ICE}"]`, content).pop();
    const senders = /** @type {JingleSenders} */ (content.getAttribute('senders') ?? 'both');

    const rtp = [];
    const fmtp = [];
    let rtcpFb = [];
    sizzle('payload-type', description).forEach((p) => {
        const parsed = parsePayloadType(p);
        rtp.push(parsed.rtp);
        if (parsed.fmtp) fmtp.push(parsed.fmtp);
        rtcpFb = rtcpFb.concat(parsed.rtcpFb);
    });

    sizzle(`> rtcp-fb[xmlns="${Strophe.NS.JINGLE_RTP_FB}"]`, description).forEach((fb) => {
        const entry = { payload: '*', type: fb.getAttribute('type') };
        const subtype = fb.getAttribute('subtype');
        if (subtype) entry.subtype = subtype;
        rtcpFb.push(entry);
    });

    const ext = sizzle(`rtp-hdrext[xmlns="${Strophe.NS.JINGLE_RTP_HDREXT}"]`, description).map((e) => ({
        value: Number(e.getAttribute('id')),
        uri: e.getAttribute('uri'),
    }));

    const ssrcGroups = sizzle(`ssrc-group[xmlns="${Strophe.NS.JINGLE_RTP_SSMA}"]`, description).map((g) => ({
        semantics: g.getAttribute('semantics'),
        ssrcs: sizzle('source', g)
            .map((s) => s.getAttribute('ssrc'))
            .join(' '),
    }));

    const ssrcs = [];
    sizzle(`source[xmlns="${Strophe.NS.JINGLE_RTP_SSMA}"]`, description).forEach((source) => {
        const id = Number(source.getAttribute('ssrc'));
        sizzle('parameter', source).forEach((p) => {
            const entry = { id, attribute: p.getAttribute('name') };
            const value = p.getAttribute('value');
            if (value !== null) entry.value = value;
            ssrcs.push(entry);
        });
    });

    const fingerprint_el = sizzle(`fingerprint[xmlns="${Strophe.NS.JINGLE_DTLS}"]`, transport).pop();
    const candidates = sizzle('candidate', transport).map((c) => elementToCandidate(c));

    /** @type {MediaDescription} */
    const media = {
        type: description.getAttribute('media'),
        port: MEDIA_PORT,
        protocol: MEDIA_PROTOCOL,
        payloads: rtp.map((r) => r.payload).join(' '),
        mid: content.getAttribute('name'),
        direction: sendersToDirection(senders, options.is_initiator),
        connection: { version: 4, ip: '0.0.0.0' },
        rtcp: { port: MEDIA_PORT, netType: 'IN', ipVer: 4, address: '0.0.0.0' },
        iceUfrag: transport.getAttribute('ufrag'),
        icePwd: transport.getAttribute('pwd'),
        iceOptions: 'trickle',
        rtp,
        fmtp,
        candidates,
    };
    if (rtcpFb.length) media.rtcpFb = rtcpFb;
    if (ext.length) media.ext = ext;
    if (ssrcGroups.length) media.ssrcGroups = ssrcGroups;
    if (ssrcs.length) media.ssrcs = ssrcs;
    if (sizzle('rtcp-mux', description).length) media.rtcpMux = 'rtcp-mux';
    if (sizzle(`extmap-allow-mixed[xmlns="${Strophe.NS.JINGLE_RTP_HDREXT}"]`, description).length) {
        media.extmapAllowMixed = 'extmap-allow-mixed';
    }
    if (fingerprint_el) {
        media.fingerprint = { type: fingerprint_el.getAttribute('hash'), hash: fingerprint_el.textContent };
        media.setup = fingerprint_el.getAttribute('setup');
    }
    return media;
}

/**
 * Convert a received Jingle stanza payload into a parsed SDP structure that can
 * be serialised with sdp-transform's `write()`.
 * @param {Element} jingle
 * @param {JingleConversionOptions} options
 * @returns {SessionDescription}
 */
export function jingleToSDP(jingle, options) {
    const contents = sizzle(`> content[xmlns="${Strophe.NS.JINGLE}"], > content`, jingle);
    const media = contents.map((c) => parseContent(c, options));

    const group_el = sizzle(`group[xmlns="${Strophe.NS.JINGLE_GROUPING}"]`, jingle).pop();
    const groups = group_el
        ? [
              {
                  type: group_el.getAttribute('semantics'),
                  mids: sizzle('content', group_el)
                      .map((c) => c.getAttribute('name'))
                      .join(' '),
              },
          ]
        : [];

    return /** @type {SessionDescription} */ ({
        version: 0,
        origin: {
            username: '-',
            sessionId: Date.now(),
            sessionVersion: 2,
            netType: 'IN',
            ipVer: 4,
            address: '127.0.0.1',
        },
        name: '-',
        timing: { start: 0, stop: 0 },
        msidSemantic: { semantic: 'WMS', token: '*' },
        groups,
        media,
    });
}
