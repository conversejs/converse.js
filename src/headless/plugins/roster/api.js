import { _converse, api, converse } from "@converse/headless/core";

const { Strophe } = converse.env;

export default {
    /**
     * @namespace _converse.api.contacts
     * @memberOf _converse.api
     */
    contacts: {
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
        async get (jids) {
            await api.waitUntil('rosterContactsFetched');
            const _getter = jid => _converse.roster.get(Strophe.getBareJidFromJid(jid));
            if (jids === undefined) {
                jids = _converse.roster.pluck('jid');
            } else if (typeof jids === 'string') {
                return _getter(jids);
            }
            return jids.map(_getter);
        },

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
        async add (jid, name) {
            await api.waitUntil('rosterContactsFetched');
            if (typeof jid !== 'string' || !jid.includes('@')) {
                throw new TypeError('contacts.add: invalid jid');
            }
            return _converse.roster.addAndSubscribe(jid, name);
        }
    }
}
