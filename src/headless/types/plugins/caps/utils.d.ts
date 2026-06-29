/**
 * Generates an XEP-0115 verification string for the given disco#info data,
 * following the generation method in XEP-0115 § 5.1.
 * @param {import('./types').CapsInfoData} data
 * @returns {Promise<string>} The base64-encoded SHA-1 hash
 */
export function generateVerificationString({ identities, features, dataforms }: import("./types").CapsInfoData): Promise<string>;
/**
 * Verifies that the given disco#info data hashes to the advertised verification
 * string (XEP-0115 § 5.4). Only the mandatory-to-implement SHA-1 algorithm is
 * supported; any other hash is treated as unverifiable.
 * @param {import('./types').CapsInfoData} info
 * @param {string} hash - The advertised hashing algorithm
 * @param {string} ver - The advertised verification string
 * @returns {Promise<boolean>}
 */
export function verifyCaps(info: import("./types").CapsInfoData, hash: string, ver: string): Promise<boolean>;
/**
 * The storage key for the XEP-0115 capabilities cache. It isn't suffixed with
 * the user's JID like most stores: the persistent storage backend is already
 * scoped to the logged-in account, and a verification hash is a content
 * address, so a single cache per account suffices.
 * @returns {string}
 */
export function getCapsCacheStorageKey(): string;
/**
 * Parses the XEP-0115 entity capabilities (`<c/>`) element from a presence
 * stanza, if present.
 * @param {Element} stanza
 * @returns {import('./types').CapsAttributes|null}
 */
export function getCapsAttrs(stanza: Element): import("./types").CapsAttributes | null;
/**
 * Returns the caps (hash, node, ver) most recently advertised by the given
 * full JID in its presence, or `undefined` if none is known.
 * @param {string} jid - The full JID of the entity
 * @returns {import('./types').CapsAttributes|undefined}
 */
export function getEntityCaps(jid: string): import("./types").CapsAttributes | undefined;
/**
 * Handler for the `parsePresence` hook which enriches the parsed presence
 * attributes with the sender's advertised XEP-0115 entity capabilities, and
 * keeps an in-memory map of full JID -> caps so that we can later look up the
 * advertised `ver` when disco information for that JID is needed.
 * @param {Element} stanza
 * @param {import('../roster/types').PresenceAttributes} attrs
 * @returns {import('../roster/types').PresenceAttributes}
 */
export function onParsePresence(stanza: Element, attrs: import("../roster/types").PresenceAttributes): import("../roster/types").PresenceAttributes;
/**
 * Parses a disco#info response stanza into the canonical structure used for caps
 * verification and caching. Unlike the disco entity's own parsing, this
 * preserves identity `xml:lang` values and all values of multi-valued data form
 * fields, both of which are needed to recompute the verification hash.
 * @param {Element} stanza
 * @returns {import('./types').CapsInfoData}
 */
export function parseDiscoInfoForCaps(stanza: Element): import("./types").CapsInfoData;
/**
 * Handler for disco's generic `discoEntityInfoRequested` hook. Given a disco
 * entity, returns the cached disco#info for the XEP-0115 caps it advertised in
 * presence (if we've already verified that `ver`) plus the caps query node, so
 * that disco can skip or scope its network query. Returns `null` if the entity
 * advertised no caps.
 * @param {import('../disco/entity').default} entity
 * @returns {import('../disco/types').DiscoInfoLookup|null}
 */
export function onDiscoEntityInfoRequested(entity: import("../disco/entity").default): import("../disco/types").DiscoInfoLookup | null;
/**
 * Handler for the `discoEntityInfoReceived` hook. After a disco#info response is
 * received and parsed, verify it against the entity's advertised `ver`
 * (XEP-0115 § 5.4) and, if valid, cache it so that future entities advertising
 * the same `ver` can skip the disco#info query.
 * @param {import('../disco/entity').default} entity
 * @param {Element} stanza
 * @returns {Promise<Element>}
 */
export function onDiscoEntityInfoReceived(entity: import("../disco/entity").default, stanza: Element): Promise<Element>;
/**
 * Detects, once per connection, whether our own server supports XEP-0115 Caps
 * Optimization (§ 8.4) and records the result so that broadcast presence can omit
 * redundant `<c/>` elements.
 * @returns {Promise<void>}
 */
export function detectCapsOptimizationSupport(): Promise<void>;
/**
 * Adds a XEP-0115 capabilities (`<c/>`) element to the given presence stanza.
 *
 * Optimization (XEP-0115 § 8.4) only applies to broadcast presence (presence
 * with no `to`). When `optimize` is true, our server supports Caps Optimization
 * and this is a broadcast presence, the `<c/>` is omitted on presences whose
 * verification string we've already advertised this session: the server re-adds
 * the annotation for new subscribers and forwards any `ver` change, so
 * re-sending an unchanged `<c/>` on every presence is wasteful. The first
 * presence (and any subsequent `ver` change) is always annotated. Directed
 * presence (e.g. a MUC join or a presence probe) is never optimized, as
 * server-side broadcast stripping doesn't apply to it.
 * @param {Strophe.Builder} stanza
 * @param {boolean} [optimize=false]
 * @returns {Promise<Strophe.Builder>}
 */
export function addCapsNode(stanza: Strophe.Builder, optimize?: boolean): Promise<Strophe.Builder>;
export namespace Strophe {
    type Builder = import("strophe.js").Builder;
}
//# sourceMappingURL=utils.d.ts.map