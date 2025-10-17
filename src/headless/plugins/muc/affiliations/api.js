/**
 * @module:plugin-muc-affiliations-api
 * @typedef {module:plugin-muc-parsers.MemberListItem} MemberListItem
 */
import { getAffiliationList, setAffiliations } from './utils.js';

export default {
    /**
     * The "affiliations" namespace groups methods relevant to setting and
     * getting MUC affiliations.
     *
     * @namespace api.rooms.affiliations
     * @memberOf api.rooms
     */
    affiliations: {
        /**
         * Set the given affiliation for the given JIDs in the specified MUCs
         * @typedef {Object} User
         * @property {string} User.jid - The JID of the user whose affiliation will change
         * @property {Array} User.affiliation - The new affiliation for this user
         * @property {string} [User.reason] - An optional reason for the affiliation change
         *
         * @param {String|Array<String>} muc_jids - The JIDs of the MUCs in
         *  which the affiliation should be set.
         * @param {User[]} users - An array of objects representing users
         *  for whom the affiliation is to be set.
         * @returns {Promise}
         *
         * @example
         *  api.rooms.affiliations.set(
         *      [
         *          'muc1@muc.example.org',
         *          'muc2@muc.example.org'
         *      ], [
         *          {
         *              'jid': 'user@example.org',
         *              'affiliation': 'member',
         *              'reason': "You're one of us now!"
         *          }
         *      ]
         *  )
         */
        set (muc_jids, users) {
            users = !Array.isArray(users) ? [users] : users;
            muc_jids = !Array.isArray(muc_jids) ? [muc_jids] : muc_jids;
            return setAffiliations(muc_jids, users);
        },

        /**
         * Returns an array of {@link MemberListItem} objects, representing occupants
         * that have the given affiliation.
         * @typedef {("admin"|"owner"|"member")} NonOutcastAffiliation
         * @param {NonOutcastAffiliation} affiliation
         * @param {string} jid - The JID of the MUC for which the affiliation list should be fetched
         * @returns {Promise<MemberListItem[]|Error>}
         */
        get (affiliation, jid) {
            return getAffiliationList(affiliation, jid);
        }
    }
}
