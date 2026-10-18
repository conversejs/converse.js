/**
 * Ask the user's server for its STUN/TURN services (XEP-0215) and map them to
 * the {@link RTCIceServer} shape RTCPeerConnection expects, with credentials
 * requested for any restricted service that came without them. `expires_at`
 * is when the first of those credentials expires, or null if none do.
 * There are no servers when the server doesn't advertise the feature.
 * @returns {Promise<{ servers: RTCIceServer[], expires_at: number|null }|null>} null if the query failed
 */
export function fetchExternalServices(): Promise<{
    servers: RTCIceServer[];
    expires_at: number | null;
} | null>;
/**
 * Discover the ICE servers when connecting. A failed query counts as already
 * expired, so that the next call tries again.
 */
export function discoverIceServers(): Promise<void>;
/**
 * The discovered ICE servers for a call that's about to connect, fetched again
 * first if their credentials have expired or are about to.
 * @returns {Promise<RTCIceServer[]>}
 */
export function getIceServers(): Promise<RTCIceServer[]>;
/**
 * Map one XEP-0215 `<service>` to an {@link RTCIceServer}, or null for entries
 * the browser can't use (non-ICE types, missing host/port/transport, a TLS
 * service over UDP, or a relay without credentials, which makes
 * RTCPeerConnection throw).
 * @param {Element} el
 * @returns {RTCIceServer|null}
 */
export function serviceToIceServer(el: Element): RTCIceServer | null;
//# sourceMappingURL=extdisco.d.ts.map