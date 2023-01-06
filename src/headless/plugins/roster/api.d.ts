declare namespace _default {
    namespace contacts {
        /**
         * This method is used to retrieve roster contacts.
         *
         * @method _converse.api.contacts.get
         * @params {(string[]|string)} jid|jids The JID or JIDs of
         *      the contacts to be returned.
         * @returns {promise} Promise which resolves with the
         *  _converse.RosterContact (or an array of them) representing the contact.
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
        function get(jids: any): Promise<any>;
        /**
         * Add a contact.
         *
         * @method _converse.api.contacts.add
         * @param {string} jid The JID of the contact to be added
         * @param {string} [name] A custom name to show the user by in the roster
         * @example
         *     _converse.api.contacts.add('buddy@example.com')
         * @example
         *     _converse.api.contacts.add('buddy@example.com', 'Buddy')
         */
        function add(jid: string, name?: string): Promise<any>;
    }
}
export default _default;
