/**
 * Hook handler for {@link parseMessage} and {@link parseMUCMessage}, which
 * parses the passed in `message` stanza for OMEMO attributes and then sets
 * them on the attrs object.
 * @param {Element} stanza - The message stanza
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @returns {Promise<MUCMessageAttributes| MessageAttributes|
        import('./types').MUCMessageAttrsWithEncryption|import('./types').MessageAttrsWithEncryption>}
 */
export function parseEncryptedMessage(stanza: Element, attrs: MUCMessageAttributes | MessageAttributes): Promise<MUCMessageAttributes | MessageAttributes | import("./types").MUCMessageAttrsWithEncryption | import("./types").MessageAttrsWithEncryption>;
/**
 * Given an XML element representing a user's OMEMO bundle, parse it
 * and return a map.
 * @param {Element} bundle_el
 * @returns {import('./types').Bundle}
 */
export function parseBundle(bundle_el: Element): import("./types").Bundle;
export type MessageAttributes = import("../..//shared/types").MessageAttributes;
export type MUCMessageAttributes = import("../../plugins/muc/types").MUCMessageAttributes;
//# sourceMappingURL=parsers.d.ts.map