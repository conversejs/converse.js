// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// This is the utilities module.
//
// Copyright (c) 2013-2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
import converse from "@converse/headless/converse-core";
import u from "./core";

const { Strophe, sizzle, _ } = converse.env;


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
 * @private
 * @method u#computeAffiliationsDelta
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
u.computeAffiliationsDelta = function computeAffiliationsDelta (exclude_existing, remove_absentees, new_list, old_list) {
    const new_jids = new_list.map(o => o.jid);
    const old_jids = old_list.map(o => o.jid);

    // Get the new affiliations
    let delta = _.map(
        _.difference(new_jids, old_jids),
        (jid) => new_list[_.indexOf(new_jids, jid)]
    );
    if (!exclude_existing) {
        // Get the changed affiliations
        delta = delta.concat(_.filter(new_list, function (item) {
            const idx = _.indexOf(old_jids, item.jid);
            if (idx >= 0) {
                return item.affiliation !== old_list[idx].affiliation;
            }
            return false;
        }));
    }
    if (remove_absentees) {
        // Get the removed affiliations
        delta = delta.concat(
            _.map(
                _.difference(old_jids, new_jids),
                (jid) => ({'jid': jid, 'affiliation': 'none'})
            )
        );
    }
    return delta;
};

/**
 * Given an IQ stanza with a member list, create an array of objects containing
 * known member data (e.g. jid, nick, role, affiliation).
 * @private
 * @method u#parseMemberListIQ
 * @returns { MemberListItem[] }
 */
u.parseMemberListIQ = function parseMemberListIQ (iq) {
    return sizzle(`query[xmlns="${Strophe.NS.MUC_ADMIN}"] item`, iq).map(
        (item) => {
            /**
             * @typedef {Object} MemberListItem
             * Either the JID or the nickname (or both) will be available.
             * @property {string} affiliation
             * @property {string} [role]
             * @property {string} [jid]
             * @property {string} [nick]
             */
            const data = {
                'affiliation': item.getAttribute('affiliation'),
            }
            const jid = item.getAttribute('jid');
            if (u.isValidJID(jid)) {
                data['jid'] = jid;
            } else {
                // XXX: Prosody sends nick for the jid attribute value
                // Perhaps for anonymous room?
                data['nick'] = jid;
            }
            const nick = item.getAttribute('nick');
            if (nick) {
                data['nick'] = nick;
            }
            const role = item.getAttribute('role');
            if (role) {
                data['role'] = nick;
            }
            return data;
        }
    );
};

