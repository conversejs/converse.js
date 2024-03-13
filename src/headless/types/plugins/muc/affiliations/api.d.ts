declare namespace _default {
    namespace affiliations {
        /**
         * Set the given affliation for the given JIDs in the specified MUCs
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
        function set(muc_jids: string | string[], users: {
            /**
             * - The JID of the user whose affiliation will change
             */
            jid: string;
            /**
             * - The new affiliation for this user
             */
            affiliation: any[];
            /**
             * - An optional reason for the affiliation change
             */
            reason?: string;
        }[]): Promise<any>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map