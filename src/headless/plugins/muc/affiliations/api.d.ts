declare namespace _default {
    namespace affiliations {
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
         * @returns { Promise }
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
        function set(muc_jids: string | string[], users: {
            jid: string;
            affiliation: "admin" | "owner" | "member" | "outcast";
            reason?: string;
        }[]): Promise<any>;
    }
}
export default _default;
