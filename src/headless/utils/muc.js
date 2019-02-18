// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// This is the utilities module.
//
// Copyright (c) 2013-2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global escape, Jed */


import converse from "@converse/headless/converse-core";
import u from "./core";

const { Strophe, sizzle, _ } = converse.env;


u.computeAffiliationsDelta = function computeAffiliationsDelta (exclude_existing, remove_absentees, new_list, old_list) {
    /* Given two lists of objects with 'jid', 'affiliation' and
     * 'reason' properties, return a new list containing
     * those objects that are new, changed or removed
     * (depending on the 'remove_absentees' boolean).
     *
     * The affiliations for new and changed members stay the
     * same, for removed members, the affiliation is set to 'none'.
     *
     * The 'reason' property is not taken into account when
     * comparing whether affiliations have been changed.
     *
     * Parameters:
     *  (Boolean) exclude_existing: Indicates whether JIDs from
     *      the new list which are also in the old list
     *      (regardless of affiliation) should be excluded
     *      from the delta. One reason to do this
     *      would be when you want to add a JID only if it
     *      doesn't have *any* existing affiliation at all.
     *  (Boolean) remove_absentees: Indicates whether JIDs
     *      from the old list which are not in the new list
     *      should be considered removed and therefore be
     *      included in the delta with affiliation set
     *      to 'none'.
     *  (Array) new_list: Array containing the new affiliations
     *  (Array) old_list: Array containing the old affiliations
     */
    const new_jids = _.map(new_list, 'jid');
    const old_jids = _.map(old_list, 'jid');

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

u.parseMemberListIQ = function parseMemberListIQ (iq) {
    /* Given an IQ stanza with a member list, create an array of member objects.
    */
    return _.map(
        sizzle(`query[xmlns="${Strophe.NS.MUC_ADMIN}"] item`, iq),
        (item) => {
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

