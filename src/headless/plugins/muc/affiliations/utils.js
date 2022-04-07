/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { AFFILIATIONS } from '@converse/headless/plugins/muc/index.js';
import difference from 'lodash-es/difference';
import indexOf from 'lodash-es/indexOf';
import log from "@converse/headless/log";
import { _converse, api, converse } from '@converse/headless/core.js';
import { parseMemberListIQ } from '../parsers.js';

const { Strophe, $iq, u } = converse.env;

/**
 * Sends an IQ stanza to the server, asking it for the relevant affiliation list .
 * Returns an array of {@link MemberListItem} objects, representing occupants
 * that have the given affiliation.
 * See: https://xmpp.org/extensions/xep-0045.html#modifymember
 * @param { ("admin"|"owner"|"member") } affiliation
 * @param { String } muc_jid - The JID of the MUC for which the affiliation list should be fetched
 * @returns { Promise<MemberListItem[]> }
 */
export async function getAffiliationList (affiliation, muc_jid) {
    const { __ } = _converse;
    const iq = $iq({ 'to': muc_jid, 'type': 'get' })
        .c('query', { xmlns: Strophe.NS.MUC_ADMIN })
        .c('item', { 'affiliation': affiliation });
    const result = await api.sendIQ(iq, null, false);
    if (result === null) {
        const err_msg = __('Error: timeout while fetching %1s list for MUC %2s', affiliation, muc_jid);
        const err = new Error(err_msg);
        log.warn(err_msg);
        return err;
    }
    if (u.isErrorStanza(result)) {
        const err_msg = __('Error: not allowed to fetch %1s list for MUC %2s', affiliation, muc_jid);
        const err = new Error(err_msg);
        log.warn(err_msg);
        log.warn(result);
        return err;
    }
    return parseMemberListIQ(result)
        .filter(p => p)
        .sort((a, b) => (a.nick < b.nick ? -1 : a.nick > b.nick ? 1 : 0));
}

/**
 * Given an occupant model, see which affiliations may be assigned to that user.
 * @param { Model } occupant
 * @returns { Array<('owner'|'admin'|'member'|'outcast'|'none')> } - An array of assignable affiliations
 */
export function getAssignableAffiliations (occupant) {
    let disabled = api.settings.get('modtools_disable_assign');
    if (!Array.isArray(disabled)) {
        disabled = disabled ? AFFILIATIONS : [];
    }
    if (occupant.get('affiliation') === 'owner') {
        return AFFILIATIONS.filter(a => !disabled.includes(a));
    } else if (occupant.get('affiliation') === 'admin') {
        return AFFILIATIONS.filter(a => !['owner', 'admin', ...disabled].includes(a));
    } else {
        return [];
    }
}

// Necessary for tests
_converse.getAssignableAffiliations = getAssignableAffiliations;

/**
 * Send IQ stanzas to the server to modify affiliations for users in this groupchat.
 * See: https://xmpp.org/extensions/xep-0045.html#modifymember
 * @param { Array<Object> } users
 * @param { string } users[].jid - The JID of the user whose affiliation will change
 * @param { Array } users[].affiliation - The new affiliation for this user
 * @param { string } [users[].reason] - An optional reason for the affiliation change
 * @returns { Promise }
 */
export function setAffiliations (muc_jid, users) {
    const affiliations = [...new Set(users.map(u => u.affiliation))];
    return Promise.all(affiliations.map(a => setAffiliation(a, muc_jid, users)));
}

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
 * @param { ('outcast'|'member'|'admin'|'owner') } affiliation - The affiliation to be set
 * @param { String|Array<String> } jids - The JID(s) of the MUCs in which the
 *  affiliations need to be set.
 * @param { object } members - A map of jids, affiliations and
 *  optionally reasons. Only those entries with the
 *  same affiliation as being currently set will be considered.
 * @returns { Promise } A promise which resolves and fails depending on the XMPP server response.
 */
export function setAffiliation (affiliation, muc_jids, members) {
    if (!Array.isArray(muc_jids)) {
        muc_jids = [muc_jids];
    }
    members = members.filter(m => [undefined, affiliation].includes(m.affiliation));
    return Promise.all(
        muc_jids.reduce((acc, jid) => [...acc, ...members.map(m => sendAffiliationIQ(affiliation, jid, m))], [])
    );
}

/**
 * Send an IQ stanza specifying an affiliation change.
 * @private
 * @param { String } affiliation: affiliation (could also be stored on the member object).
 * @param { String } muc_jid: The JID of the MUC in which the affiliation should be set.
 * @param { Object } member: Map containing the member's jid and optionally a reason and affiliation.
 */
function sendAffiliationIQ (affiliation, muc_jid, member) {
    const iq = $iq({ to: muc_jid, type: 'set' })
        .c('query', { xmlns: Strophe.NS.MUC_ADMIN })
        .c('item', {
            'affiliation': member.affiliation || affiliation,
            'nick': member.nick,
            'jid': member.jid
        });
    if (member.reason !== undefined) {
        iq.c('reason', member.reason);
    }
    return api.sendIQ(iq);
}

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
 * @param { boolean } exclude_existing - Indicates whether JIDs from
 *      the new list which are also in the old list
 *      (regardless of affiliation) should be excluded
 *      from the delta. One reason to do this
 *      would be when you want to add a JID only if it
 *      doesn't have *any* existing affiliation at all.
 * @param { boolean } remove_absentees - Indicates whether JIDs
 *      from the old list which are not in the new list
 *      should be considered removed and therefore be
 *      included in the delta with affiliation set
 *      to 'none'.
 * @param { array } new_list - Array containing the new affiliations
 * @param { array } old_list - Array containing the old affiliations
 * @returns { array }
 */
export function computeAffiliationsDelta (exclude_existing, remove_absentees, new_list, old_list) {
    const new_jids = new_list.map(o => o.jid);
    const old_jids = old_list.map(o => o.jid);
    // Get the new affiliations
    let delta = difference(new_jids, old_jids).map(jid => new_list[indexOf(new_jids, jid)]);
    if (!exclude_existing) {
        // Get the changed affiliations
        delta = delta.concat(
            new_list.filter(item => {
                const idx = indexOf(old_jids, item.jid);
                return idx >= 0 ? item.affiliation !== old_list[idx].affiliation : false;
            })
        );
    }
    if (remove_absentees) {
        // Get the removed affiliations
        delta = delta.concat(difference(old_jids, new_jids).map(jid => ({ 'jid': jid, 'affiliation': 'none' })));
    }
    return delta;
}
