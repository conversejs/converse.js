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
 * @returns {Promise<MUCMessageAttributes|Error>}
 */
export function parseMUCMessage(stanza: Element, chatbox: MUC): Promise<MUCMessageAttributes | Error>;
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
export type MUCMessageAttributes = any;
//# sourceMappingURL=parsers.d.ts.map