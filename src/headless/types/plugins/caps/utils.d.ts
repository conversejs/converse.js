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
 * Given a stanza, adds a XEP-0115 CAPS element
 * @param {Strophe.Builder} stanza
 */
export function addCapsNode(stanza: Strophe.Builder): Promise<import("strophe.js").Builder>;
export namespace Strophe {
    type Builder = import("strophe.js").Builder;
}
//# sourceMappingURL=utils.d.ts.map