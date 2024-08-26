/**
 * @typedef {Object} ExtraMUCAttributes
 * @property {Array<Object>} activities - A list of objects representing XEP-0316 MEP notification data
 * @property {String} from_muc - The JID of the MUC from which this message was sent
 * @property {String} from_real_jid - The real JID of the sender, if available
 * @property {String} moderated - The type of XEP-0425 moderation (if any) that was applied
 * @property {String} moderated_by - The JID of the user that moderated this message
 * @property {String} moderated_id - The  XEP-0359 Stanza ID of the message that this one moderates
 * @property {String} moderation_reason - The reason provided why this message moderates another
 * @property {String} occupant_id - The XEP-0421 occupant ID
 *
 * The object which {@link parseMUCMessage} returns
 * @typedef {import('../chat/parsers').MessageAttributes & ExtraMUCAttributes} MUCMessageAttributes
 */
/**
 * Parses a message stanza for XEP-0316 MEP notification data
 * @param {Element} stanza - The message stanza
 * @returns {Array} Returns an array of objects representing <activity> elements.
 */
export function getMEPActivities(stanza: Element): any[];
/**
 * Parses a passed in message stanza and returns an object of attributes.
 * @param {Element} stanza - The message stanza
 * @param {MUC} chatbox
 * @returns {Promise<MUCMessageAttributes|StanzaParseError>}
 */
export function parseMUCMessage(stanza: Element, chatbox: MUC): Promise<MUCMessageAttributes | StanzaParseError>;
/**
 * Given an IQ stanza with a member list, create an array of objects containing
 * known member data (e.g. jid, nick, role, affiliation).
 *
 * @typedef {Object} MemberListItem
 * Either the JID or the nickname (or both) will be available.
 * @property {string} affiliation
 * @property {string} [role]
 * @property {string} [jid]
 * @property {string} [nick]
 *
 * @param {Element} iq
 * @returns {MemberListItem[]}
 */
export function parseMemberListIQ(iq: Element): MemberListItem[];
/**
 * Parses a passed in MUC presence stanza and returns an object of attributes.
 * @method parseMUCPresence
 * @param {Element} stanza - The presence stanza
 * @param {MUC} chatbox
 * @returns {MUCPresenceAttributes}
 */
export function parseMUCPresence(stanza: Element, chatbox: MUC): {
    show: string;
    /**
     * - An array of XEP-0317 hats
     */
    hats: Array<{
        title: string;
        /**
         * The object which {@link parseMUCPresence} returns
         */
        uri: string;
    }>;
    states: Array<string>;
    /**
     * - The sender JID (${muc_jid}/${nick})
     */
    from: string;
    /**
     * - The nickname of the sender
     */
    nick: string;
    /**
     * - The XEP-0421 occupant ID
     */
    occupant_id: string;
    /**
     * - The type of presence
     */
    type: string;
    jid?: string;
    is_me?: boolean;
};
export type ExtraMUCAttributes = {
    /**
     * - A list of objects representing XEP-0316 MEP notification data
     */
    activities: Array<any>;
    /**
     * - The JID of the MUC from which this message was sent
     */
    from_muc: string;
    /**
     * - The real JID of the sender, if available
     */
    from_real_jid: string;
    /**
     * - The type of XEP-0425 moderation (if any) that was applied
     */
    moderated: string;
    /**
     * - The JID of the user that moderated this message
     */
    moderated_by: string;
    /**
     * - The  XEP-0359 Stanza ID of the message that this one moderates
     */
    moderated_id: string;
    /**
     * - The reason provided why this message moderates another
     */
    moderation_reason: string;
    /**
     * - The XEP-0421 occupant ID
     *
     * The object which {@link parseMUCMessage} returns
     */
    occupant_id: string;
};
export type MUCMessageAttributes = import("../chat/parsers").MessageAttributes & ExtraMUCAttributes;
/**
 * Either the JID or the nickname (or both) will be available.
 */
export type MemberListItem = {
    affiliation: string;
    role?: string;
    jid?: string;
    nick?: string;
};
export type MUC = import("../muc/muc.js").default;
import { StanzaParseError } from '../../shared/parsers';
//# sourceMappingURL=parsers.d.ts.map