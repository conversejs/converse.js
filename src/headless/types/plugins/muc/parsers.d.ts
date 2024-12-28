/**
 * Parses a message stanza for XEP-0316 MEP notification data
 * @param {Element} stanza - The message stanza
 * @returns {Array} Returns an array of objects representing <activity> elements.
 */
export function getMEPActivities(stanza: Element): any[];
/**
 * Parses a passed in message stanza and returns an object of attributes.
 * @param {Element} original_stanza - The message stanza
 * @param {MUC} chatbox
 * @returns {Promise<MUCMessageAttributes|StanzaParseError>}
 */
export function parseMUCMessage(original_stanza: Element, chatbox: MUC): Promise<MUCMessageAttributes | StanzaParseError>;
/**
 * Given an IQ stanza with a member list, create an array of objects containing
 * known member data (e.g. jid, nick, role, affiliation).
 *
 * @param {Element} iq
 * @returns {import('./types').MemberListItem[]}
 */
export function parseMemberListIQ(iq: Element): import("./types").MemberListItem[];
/**
 * Parses a passed in MUC presence stanza and returns an object of attributes.
 * @param {Element} stanza - The presence stanza
 * @param {MUC} chatbox
 * @returns {import('./types').MUCPresenceAttributes}
 */
export function parseMUCPresence(stanza: Element, chatbox: MUC): import("./types").MUCPresenceAttributes;
export type MUC = import("../muc/muc.js").default;
export type MUCMessageAttributes = import("./types").MUCMessageAttributes;
import { StanzaParseError } from '../../shared/errors.js';
//# sourceMappingURL=parsers.d.ts.map