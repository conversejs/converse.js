/**
 * Parses the XEP-0115 entity capabilities (`<c/>`) element from a presence
 * stanza, if present.
 * @param {Element} stanza
 * @returns {import('./types').CapsAttributes|null}
 */
export function getCapsAttrs(stanza: Element): import("./types").CapsAttributes | null;
/**
 * Handler for the `parsePresence` hook which enriches the parsed presence
 * attributes with the sender's advertised XEP-0115 entity capabilities.
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