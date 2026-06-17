import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';

const { Strophe, sizzle, stx } = converse.env;

// Service types XEP-0215 can advertise that are usable as ICE servers.
const ICE_TYPES = ['stun', 'turn', 'stuns', 'turns'];

// Transports the browser can dial.
const TRANSPORTS = ['udp', 'tcp'];

/**
 * Ask the user's server for its STUN/TURN services (XEP-0215) and map them to
 * the {@link RTCIceServer} shape RTCPeerConnection expects. Returns an empty
 * list when the server doesn't advertise the feature or the query fails.
 * @returns {Promise<RTCIceServer[]>}
 */
export async function fetchExternalServices() {
    const domain = _converse.session.get('domain');
    try {
        if (!(await api.disco.supports(Strophe.NS.EXTDISCO, domain))) return [];

        const iq = stx`
            <iq xmlns="jabber:client" type="get" to="${domain}">
                <services xmlns="${Strophe.NS.EXTDISCO}"/>
            </iq>`;
        const result = await api.sendIQ(iq);
        return sizzle(`services[xmlns="${Strophe.NS.EXTDISCO}"] > service`, result)
            .map(serviceToIceServer)
            .filter(Boolean);
    } catch (e) {
        log.error(e);
        return [];
    }
}

/**
 * Map one XEP-0215 `<service>` to an {@link RTCIceServer}, or null for entries
 * the browser can't use (non-ICE types, missing host/port/transport, a TLS
 * service over UDP, or a relay without credentials, which makes
 * RTCPeerConnection throw).
 * @param {Element} el
 * @returns {RTCIceServer|null}
 */
export function serviceToIceServer(el) {
    const type = el.getAttribute('type');
    const host = el.getAttribute('host');
    const port = el.getAttribute('port');
    const transport = el.getAttribute('transport');
    if (!ICE_TYPES.includes(type) || !host || !port || !TRANSPORTS.includes(transport)) return null;

    const tls = type === 'stuns' || type === 'turns';
    if (tls && transport === 'udp') return null;

    const relay = type === 'turn' || type === 'turns';
    const username = el.getAttribute('username');
    const credential = el.getAttribute('password');
    if (relay && (username === null || credential === null)) return null;

    // A raw IPv6 host needs brackets or its colons collide with the port separator.
    const authority = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;

    if (!relay) return { urls: `${type}:${authority}:${port}` }; // STUN URLs take no transport query
    return { urls: `${type}:${authority}:${port}?transport=${transport}`, username, credential };
}
