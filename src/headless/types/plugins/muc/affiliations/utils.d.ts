/**
 * Sends an IQ stanza to the server, asking it for the relevant affiliation list .
 * Returns an array of {@link MemberListItem} objects, representing occupants
 * that have the given affiliation.
 * See: https://xmpp.org/extensions/xep-0045.html#modifymember
 * @param {import('../types').NonOutcastAffiliation} affiliation
 * @param {string} muc_jid - The JID of the MUC for which the affiliation list should be fetched
 * @returns {Promise<MemberListItem[]|Error>}
 */
export function getAffiliationList(affiliation: import("../types").NonOutcastAffiliation, muc_jid: string): Promise<MemberListItem[] | Error>;
/**
 * Send IQ stanzas to the server to modify affiliations for users in this groupchat.
 * See: https://xmpp.org/extensions/xep-0045.html#modifymember
 * @param {String|Array<String>} muc_jid - The JID(s) of the MUCs in which the
 * @param {Array<User>} users
 * @returns {Promise}
 */
export function setAffiliations(muc_jid: string | Array<string>, users: Array<User>): Promise<any>;
/**
 * Send IQ stanzas to the server to set an affiliation for
 * the provided JIDs.
 * See: https://xmpp.org/extensions/xep-0045.html#modifymember
 *
 * Prosody doesn't accept multiple JIDs' affiliations
 * being set in one IQ stanza, so as a workaround we send
 * a separate stanza for each JID.
 * Related ticket: https://issues.prosody.im/345
 *
 * @param {AFFILIATIONS[number]} affiliation - The affiliation to be set
 * @param {String|Array<String>} muc_jids - The JID(s) of the MUCs in which the
 *  affiliations need to be set.
 * @param {object} members - A map of jids, affiliations and
 *  optionally reasons. Only those entries with the
 *  same affiliation as being currently set will be considered.
 * @returns {Promise} A promise which resolves and fails depending on the XMPP server response.
 */
export function setAffiliation(affiliation: AFFILIATIONS[number], muc_jids: string | Array<string>, members: object): Promise<any>;
/**
 * Given two lists of objects with 'jid', 'affiliation' and
 * 'reason' properties, return a new list containing
 * those objects that are new, changed or removed
 * (depending on the 'remove_absentees' boolean).
 *
 * The affiliations for new and changed members stay the
 * same, for removed members, the affiliation is set to 'none'.
 *
 * The 'reason' property is not taken into account when
 * comparing whether affiliations have been changed.
 * @param {boolean} exclude_existing - Indicates whether JIDs from
 *      the new list which are also in the old list
 *      (regardless of affiliation) should be excluded
 *      from the delta. One reason to do this
 *      would be when you want to add a JID only if it
 *      doesn't have *any* existing affiliation at all.
 * @param {boolean} remove_absentees - Indicates whether JIDs
 *      from the old list which are not in the new list
 *      should be considered removed and therefore be
 *      included in the delta with affiliation set
 *      to 'none'.
 * @param {array} new_list - Array containing the new affiliations
 * @param {array} old_list - Array containing the old affiliations
 * @returns {array}
 */
export function computeAffiliationsDelta(exclude_existing: boolean, remove_absentees: boolean, new_list: any[], old_list: any[]): any[];
export type MemberListItem = any;
export type User = any;
export type Model = import("@converse/skeletor").Model;
export type AFFILIATIONS = any[];
//# sourceMappingURL=utils.d.ts.map