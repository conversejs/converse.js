import { isValidJID } from '../../utils/jid.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

export default {
    /**
     * @namespace _converse.api.contacts
     * @memberOf _converse.api
     *
     * @typedef {import('./contact').default} RosterContact
     */
    contacts: {
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
        async get(jids) {
            await api.waitUntil('rosterContactsFetched');
            const { roster } = _converse.state;
            const _getter = /** @param {string} jid */ (jid) => roster.get(Strophe.getBareJidFromJid(jid));
            if (jids === undefined) {
                jids = roster.pluck('jid');
            } else if (typeof jids === 'string') {
                return _getter(jids);
            }
            return /** @type {string[]} */ (jids).map(_getter);
        },

        /**
         * Whether a contact identifies itself as a bot, i.e. one of its online
         * resources advertises the XEP-0030 identity `client/bot`.
         *
         * The identity is self-declared, so this is a label for people and
         * must not gate anything else. It answers from the identities already
         * known and never issues a disco#info query, so it's safe to call while
         * rendering. A resource whose identities haven't been looked up yet
         * doesn't count, so a contact is "not known to be a bot", not "a person".
         *
         * @method _converse.api.contacts.isBot
         * @param {string} jid - A bare JID, or a full JID for one resource.
         * @returns {boolean}
         */
        isBot(jid) {
            const bare_jid = Strophe.getBareJidFromJid(jid);
            const resource = Strophe.getResourceFromJid(jid);
            const presence = _converse.state.presences?.get(bare_jid);
            const names = resource ? [resource] : (presence?.resources.pluck('name') ?? []);
            const entities = names.map((name) => _converse.state.disco_entities?.get(`${bare_jid}/${name}`));
            return entities.some((entity) => !!entity?.identities.findWhere({ category: 'client', type: 'bot' }));
        },

        /**
         * Remove a contact from the roster
         * @param {string} jid
         * @param {boolean} [unsubscribe] - Whether we should unsubscribe
         * from the contact's presence updates.
         */
        async remove(jid, unsubscribe) {
            await api.waitUntil('rosterContactsFetched');
            const contact = await api.contacts.get(jid);
            contact.remove(unsubscribe);
        },

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
        async add(attributes, persist = true, subscribe = true, message = '') {
            if (!isValidJID(attributes?.jid)) throw new Error('api.contacts.add: Valid JID required');

            const { roster } = _converse.state;
            return roster.addContact(attributes, persist, subscribe, message);
        },
    },
};
