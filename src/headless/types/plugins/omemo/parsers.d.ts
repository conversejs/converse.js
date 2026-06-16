/**
 * Hook handler for {@link parseMessage} and {@link parseMUCMessage}, which
 * parses the passed in `message` stanza for OMEMO attributes and then sets
 * them on the attrs object.
 *
 * A single stanza may carry both an `urn:xmpp:omemo:2` and a legacy
 * `eu.siacs.conversations.axolotl` `<encrypted>` element: a sender that
 * supports both addresses each recipient device in whichever version that
 * device understands. The EME (XEP-0380) hint names only one method and exists
 * for clients that can decrypt *neither* — it must not be used to pick a
 * decryption path. So we route on which `<encrypted>` block actually contains a
 * `<key>` for our own device, preferring omemo:2.
 *
 * @param {Element} stanza - The message stanza
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @param {import('../muc/muc.js').default} [chatbox] - The MUC model (only for
 *   `parseMUCMessage`); used to re-parse encrypted reactions from the SCE content.
 * @returns {Promise<MUCMessageAttributes| MessageAttributes|MUCMessageAttrsWithEncryption|MessageAttrsWithEncryption>}
 */
export function parseEncryptedMessage(stanza: Element, attrs: MUCMessageAttributes | MessageAttributes, chatbox?: import("../muc/muc.js").default): Promise<MUCMessageAttributes | MessageAttributes | MUCMessageAttrsWithEncryption | MessageAttrsWithEncryption>;
/**
 * Given an XML element representing a legacy OMEMO bundle, parse it
 * and return a map.
 * @param {Element} bundle_el
 * @returns {import('./types').Bundle}
 */
export function parseBundle(bundle_el: Element): import("./types").Bundle;
/**
 * Given an XML element representing an OMEMO 2 bundle, parse it
 * and return a map using the same internal format as the legacy bundle.
 *
 * All key values are base64-encoded 32-byte raw Curve25519/Ed25519 bytes
 * (the leading 0x05 byte is absent for v2).
 *
 * @param {Element} bundle_el
 * @returns {import('./types').Bundle}
 */
export function parseBundleV2(bundle_el: Element): import("./types").Bundle;
export type MessageAttributes = import("../../shared/types").MessageAttributes;
export type MUCMessageAttributes = import("../../plugins/muc/types").MUCMessageAttributes;
export type MUCMessageAttrsWithEncryption = import("./types").MUCMessageAttrsWithEncryption;
export type MessageAttrsWithEncryption = import("./types").MessageAttrsWithEncryption;
//# sourceMappingURL=parsers.d.ts.map