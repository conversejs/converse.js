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
         * Finds the roster contacts that a query refers to, so that a command
         * can take "Romeo" as well as a JID.
         *
         * Pass exactly one of `jid` or `name`. The two are never told apart from
         * each other, so a name that happens to look like a JID is still looked up
         * as a name when it's passed as one.
         *
         * A `jid` matches that JID, whether or not it's on the roster. A `name`
         * matches the contacts whose nickname or vCard name is the same, ignoring
         * case. Nothing is guessed: a name shared by several contacts returns all of
         * them, and the caller decides what to do.
         *
         * @method _converse.api.contacts.resolve
         * @param {{jid?: string, name?: string}} query - Exactly one of a bare JID or a name
         * @returns {Promise<{jid: string, name: string|null}[]>} The matches,
         *  ordered by JID. Empty when a name matches nothing.
         * @throws {Error} If neither or both of `jid` and `name` are given, or the `jid` is not a JID.
         */
        function resolve({ jid, name }?: {
            jid?: string;
            name?: string;
        }): Promise<{
            jid: string;
            name: string | null;
        }[]>;
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
         * @param {boolean} subscribe - Whether a presence subscription should
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