import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';

const { Strophe, sizzle, stx } = converse.env;

// Service types XEP-0215 can advertise that are usable as ICE servers.
const ICE_TYPES = ['stun', 'turn', 'stuns', 'turns'];

// Transports the browser can dial.
const TRANSPORTS = ['udp', 'tcp'];

// Credentials this close to expiring are fetched again before a call uses them.
const EXPIRY_MARGIN = 60_000;

/**
 * Ask the server for the credentials of a service it advertised as restricted
 * but without any (XEP-0215 § 3.3). Returns the service unchanged if it can't.
 * @param {Element} el - the advertised `<service>`
 * @returns {Promise<Element>}
 */
async function withCredentials(el) {
    const host = el.getAttribute('host');
    const type = el.getAttribute('type');
    const port = el.getAttribute('port');
    const iq = stx`
        <iq xmlns="jabber:client" type="get" to="${_converse.session.get('domain')}">
            <credentials xmlns="${Strophe.NS.EXTDISCO}">
                <service host="${host}" type="${type}" port="${port}"/>
            </credentials>
        </iq>`;

    try {
        const result = await api.sendIQ(iq);
        const granted = sizzle(`credentials[xmlns="${Strophe.NS.EXTDISCO}"] > service`, result).find(
            (s) => !s.getAttribute('port') || s.getAttribute('port') === port,
        );
        if (!granted) return el;

        const merged = /** @type {Element} */ (el.cloneNode());
        ['username', 'password', 'expires'].forEach((name) => {
            const value = granted.getAttribute(name);
            if (value !== null) merged.setAttribute(name, value);
        });
        return merged;
    } catch (e) {
        log.warn(e);
        return el;
    }
}

/**
 * Ask the user's server for its STUN/TURN services (XEP-0215) and map them to
 * the {@link RTCIceServer} shape RTCPeerConnection expects, with credentials
 * requested for any restricted service that came without them. `expires_at`
 * is when the first of those credentials expires, or null if none do.
 * There are no servers when the server doesn't advertise the feature.
 * @returns {Promise<{ servers: RTCIceServer[], expires_at: number|null }|null>} null if the query failed
 */
export async function fetchExternalServices() {
    const domain = _converse.session.get('domain');
    try {
        if (!(await api.disco.supports(Strophe.NS.EXTDISCO, domain))) return { servers: [], expires_at: null };

        const iq = stx`
            <iq xmlns="jabber:client" type="get" to="${domain}">
                <services xmlns="${Strophe.NS.EXTDISCO}"/>
            </iq>`;
        const result = await api.sendIQ(iq);
        const services = await Promise.all(
            sizzle(`services[xmlns="${Strophe.NS.EXTDISCO}"] > service`, result).map((el) => {
                const restricted = ['true', '1'].includes(el.getAttribute('restricted'));
                return restricted && el.getAttribute('password') === null ? withCredentials(el) : el;
            }),
        );
        const usable = services.filter((el) => serviceToIceServer(el));
        const expiries = usable.map((el) => Date.parse(el.getAttribute('expires'))).filter((t) => !Number.isNaN(t));
        return {
            servers: usable.map(serviceToIceServer),
            expires_at: expiries.length ? Math.min(...expiries) : null,
        };
    } catch (e) {
        log.error(e);
        return null;
    }
}

/**
 * Discover the ICE servers when connecting. A failed query counts as already
 * expired, so that the next call tries again.
 */
export async function discoverIceServers() {
    _converse.state.ice_servers = (await fetchExternalServices()) ?? { servers: [], expires_at: Date.now() };
}

/**
 * The discovered ICE servers for a call that's about to connect, fetched again
 * first if their credentials have expired or are about to.
 * @returns {Promise<RTCIceServer[]>}
 */
export async function getIceServers() {
    const expires_at = _converse.state.ice_servers?.expires_at;
    if (expires_at && expires_at - Date.now() < EXPIRY_MARGIN) {
        // If the query fails, keep what we had: its STUN servers still work,
        // and since it's still expiring the next call tries again.
        const fresh = await fetchExternalServices();
        if (fresh) _converse.state.ice_servers = fresh;
    }
    return _converse.state.ice_servers?.servers ?? [];
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
