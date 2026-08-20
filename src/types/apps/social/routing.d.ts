/**
 * Parse a `location.hash` into a Social route, or null when the hash is not a
 * Social route (so other routers can ignore it too). Never throws: a malformed
 * `#converse/social/...` falls back to the timeline.
 * @param {string} [hash=location.hash]
 * @returns {import("./types.ts").SocialRoute|null}
 */
export function parseSocialRoute(hash?: string): import("./types.ts").SocialRoute | null;
/**
 * Build the `#converse/...` hash for a Social route, or null when the route is
 * incomplete (so callers can no-op). The node segment is omitted for the common
 * microblog node, keeping post URLs terse.
 * @param {import("./types.ts").SocialRoute} route
 * @returns {string|null}
 */
export function buildSocialRoute(route: import("./types.ts").SocialRoute): string | null;
export const SOCIAL_ROUTE_ROOT: "#converse/social";
//# sourceMappingURL=routing.d.ts.map