declare namespace _default {
    namespace contacts {
        /**
         * This method is used to retrieve roster contacts.
         *
         * @method _converse.api.contacts.get
         * @param {(string[]|string)} jids The JID or JIDs of the contacts to be returned.
         * @returns {promise} Promise which resolves with the
         *  {@link RosterContact} (or an array of them) representing the contact.
         *
         * @example
         * // Fetch a single contact
         * _converse.api.listen.on('rosterContactsFetched', function () {
         *     const contact = await _converse.api.contacts.get('buddy@example.com')
         *     // ...
         * });
         *
         * @example
         * // To get multiple contacts, pass in an array of JIDs:
         * _converse.api.listen.on('rosterContactsFetched', function () {
         *     const contacts = await _converse.api.contacts.get(
         *         ['buddy1@example.com', 'buddy2@example.com']
         *     )
         *     // ...
         * });
         *
         * @example
         * // To return all contacts, simply call ``get`` without any parameters:
         * _converse.api.listen.on('rosterContactsFetched', function () {
         *     const contacts = await _converse.api.contacts.get();
         *     // ...
         * });
         */
        function get(jids: (string[] | string)): Promise<any>;
        /**
         * Remove a contact from the roster
         * @param {string} jid
         * @param {boolean} [unsubscribe] - Whether we should unsubscribe
         * from the contact's presence updates.
         */
        function remove(jid: string, unsubscribe?: boolean): Promise<void>;
        /**
         * Add a contact.
         * @param {import('./types').RosterContactAttributes} attributes
         * @param {boolean} [persist=true] - Whether the contact should be persisted to the user's roster.
         * @param {boolean} [subscribe=true] - Whether we should subscribe to the contacts presence updates.
         * @param {string} [message=''] - An optional message to include with the presence subscription
         * @param {boolean} subscribe - Whether a presense subscription should
         *      be sent out to the contact being added.
         * @returns {Promise<RosterContact>}
         * @example
         *      api.contacts.add({ jid: 'buddy@example.com', groups: ['Buddies'] })
         */
        function add(attributes: import("./types").RosterContactAttributes, persist?: boolean, subscribe?: boolean, message?: string): Promise<import("./contact").default>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map