/**
 * Ask the user's server for its STUN/TURN services (XEP-0215) and map them to
 * the {@link RTCIceServer} shape RTCPeerConnection expects. Returns an empty
 * list when the server doesn't advertise the feature or the query fails, so it
 * can be merged with `call_ice_servers` without ever breaking a call.
 * @returns {Promise<RTCIceServer[]>}
 */
export function fetchExternalServices(): Promise<RTCIceServer[]>;
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