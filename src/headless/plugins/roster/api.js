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
        async resolve({ jid, name } = {}) {
            if ((jid === undefined) === (name === undefined)) {
                throw new Error('Pass exactly one of "jid" or "name" to resolve');
            }
            await api.waitUntil('rosterContactsFetched');
            const { roster } = _converse.state;

            if (jid !== undefined) {
                const bare = typeof jid === 'string' ? Strophe.getBareJidFromJid(jid.trim()) : '';
                if (!isValidJID(bare)) throw new Error(`"${jid}" is not a JID`);
                return [{ jid: bare, name: roster.get(bare)?.getDisplayName({ no_jid: true }) ?? null }];
            }

            const wanted = typeof name === 'string' ? name.trim().toLowerCase() : '';
            if (!wanted) return [];

            const matches = roster.filter((contact) => {
                const names = [contact.get('nickname'), contact.vcard?.getDisplayName()];
                return names.some((candidate) => candidate?.toLowerCase() === wanted);
            });
            return matches
                .map((contact) => ({ jid: contact.get('jid'), name: contact.getDisplayName({ no_jid: true }) ?? null }))
                .sort((a, b) => a.jid.localeCompare(b.jid));
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
            return await roster.addContact(attributes, persist, subscribe, message);
        },
    },
};
