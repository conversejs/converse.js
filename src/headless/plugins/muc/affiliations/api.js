import { setAffiliations } from './utils.js';

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
         * Set the given affliation for the given JIDs in the specified MUCs
         *
         * @param { String|Array<String> } muc_jids - The JIDs of the MUCs in
         *  which the affiliation should be set.
         * @param { Object[] } users - An array of objects representing users
         *  for whom the affiliation is to be set.
         * @param { String } users[].jid - The JID of the user whose affiliation will change
         * @param { ('outcast'|'member'|'admin'|'owner') } users[].affiliation - The new affiliation for this user
         * @param { String } [users[].reason] - An optional reason for the affiliation change
         */
        set (muc_jids, users) {
            users = !Array.isArray(users) ? [users] : users;
            muc_jids = !Array.isArray(muc_jids) ? [muc_jids] : muc_jids;
            return setAffiliations(muc_jids, users);
        }
    }
}
