import { Collection, Model } from '@converse/skeletor';
import RosterContact from './contact.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';
import { initStorage } from '../../utils/storage.js';
import { rejectPresenceSubscription } from './utils.js';

const { Strophe, sizzle, stx, u, Stanza } = converse.env;

class RosterContacts extends Collection {
    constructor() {
        super();
        this.model = RosterContact;
        this.data = null;
    }

    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `roster.state-${bare_jid}-${this.get('jid')}`;
        this.state = new Model({ id, 'collapsed_groups': [] });
        initStorage(this.state, id);
        this.state.fetch();
        api.listen.on(
            'chatBoxClosed',
            /** @param {import('../../shared/chatbox').default} model */
            (model) => this.removeUnsavedContact(model)
        );
    }

    /**
     * @param {import('../../shared/chatbox').default} model
     */
    removeUnsavedContact(model) {
        const contact = this.get(model.get('jid'));
        if (contact && contact.get('subscription') === undefined) {
            contact.destroy();
        }
    }

    onConnected() {
        // Called as soon as the connection has been established
        // (either after initial login, or after reconnection).
        // Use the opportunity to register stanza handlers.
        this.registerRosterHandler();
        this.registerRosterXHandler();
    }

    /**
     * Register a handler for roster IQ "set" stanzas, which update
     * roster contacts.
     */
    registerRosterHandler() {
        // Register a handler for roster IQ "set" stanzas, which update
        // roster contacts.
        api.connection.get().addHandler(
            /** @param {Element} iq */ (iq) => {
                _converse.state.roster.onRosterPush(iq);
                return true;
            },
            Strophe.NS.ROSTER,
            'iq',
            'set'
        );
    }

    /**
     * Register a handler for RosterX message stanzas, which are
     * used to suggest roster contacts to a user.
     */
    registerRosterXHandler() {
        let t = 0;
        const connection = api.connection.get();
        connection.addHandler(
            /** @param {Element} msg */ (msg) => {
                setTimeout(() => {
                    const { roster } = _converse.state;
                    api.connection.get().flush();
                    roster.subscribeToSuggestedItems(msg);
                }, t);
                t += msg.querySelectorAll('item').length * 250;
                return true;
            },
            Strophe.NS.ROSTERX,
            'message',
            null
        );
    }

    /**
     * Fetches the roster contacts, first by trying the browser cache,
     * and if that's empty, then by querying the XMPP server.
     * @returns {promise} Promise which resolves once the contacts have been fetched.
     */
    async fetchRosterContacts() {
        const result = await new Promise((resolve, reject) => {
            this.fetch({
                add: true,
                silent: true,
                success: resolve,
                error: (_, e) => reject(e),
            });
        });
        if (u.isErrorObject(result)) {
            log.error(result);
            // Force a full roster refresh
            _converse.session.save('roster_cached', false);
            this.data.save('version', undefined);
        }

        if (_converse.session.get('roster_cached')) {
            /**
             * The contacts roster has been retrieved from the local cache
             * @event _converse#cachedRoster
             * @type {RosterContacts}
             * @example _converse.api.listen.on('cachedRoster', (items) => { ... });
             * @example _converse.api.waitUntil('cachedRoster').then(items => { ... });
             */
            api.trigger('cachedRoster', result);
        } else {
            api.connection.get().send_initial_presence = true;
            return _converse.state.roster.fetchFromServer();
        }
    }

    /**
     * @param {Element} msg
     */
    subscribeToSuggestedItems(msg) {
        Array.from(msg.querySelectorAll('item')).forEach((item) => {
            if (item.getAttribute('action') === 'add') {
                this.addContact({
                    jid: item.getAttribute('jid'),
                    name: item.getAttribute('name'),
                    subscription: 'to',
                });
            }
        });
        return true;
    }

    /**
     * @param {string} jid
     */
    isSelf(jid) {
        return u.isSameBareJID(jid, api.connection.get().jid);
    }

    /**
     * Send an IQ stanza to the XMPP server to add a new roster contact.
     * @param {import('./types').RosterContactAttributes} attributes
     */
    sendContactAddIQ(attributes) {
        const { jid, groups } = attributes;
        const name = attributes.name ? attributes.name : null;
        const iq = stx`
            <iq type="set" xmlns="jabber:client">
                <query xmlns="${Strophe.NS.ROSTER}">
                    <item jid="${jid}" ${name ? Stanza.unsafeXML(`name="${Strophe.xmlescape(name)}"`) : ''}>
                        ${groups?.map(/** @param {string} g */ (g) => stx`<group>${g}</group>`)}
                    </item>
                </query>
            </iq>`;
        return api.sendIQ(iq);
    }

    /**
     * Adds a {@link RosterContact} instance to {@link RosterContacts} and
     * optionally (if subscribe=true) subscribe to the contact's presence
     * updates which also adds the contact to the roster on the XMPP server.
     * @param {import('./types').RosterContactAttributes} attributes
     * @param {boolean} [persist=true] - Whether the contact should be persisted to the user's roster.
     * @param {boolean} [subscribe=true] - Whether we should subscribe to the contacts presence updates.
     * @param {string} [message=''] - An optional message to include with the presence subscription
     * @returns {Promise<RosterContact>}
     */
    async addContact(attributes, persist = true, subscribe = true, message = '') {
        const { jid, name } = attributes ?? {};
        if (!jid || !u.isValidJID(jid)) throw new Error('Invalid JID provided to addContact');

        await api.waitUntil('rosterContactsFetched');

        if (persist) {
            try {
                await this.sendContactAddIQ(attributes);
            } catch (e) {
                log.error(e);
                const { __ } = _converse;
                alert(__('Sorry, an error occurred while trying to add %1$s as a contact.', name || jid));
                throw e;
            }
        }

        const contact = await this.create(
            {
                ...{
                    ask: undefined,
                    nickname: name,
                    groups: [],
                    requesting: false,
                    subscription: persist ? 'none' : undefined,
                },
                ...attributes,
            },
            { sort: false }
        );

        if (subscribe) contact.subscribe(message);

        return contact;
    }

    /**
     * @param {string} bare_jid
     * @param {Element} presence
     * @param {string} [auth_msg=''] - Optional message to be included in the
     *   authorization of the contacts subscription request.
     * @param {string} [sub_msg=''] - Optional message to be included in our
     *   reciprocal subscription request.
     */
    async subscribeBack(bare_jid, presence, auth_msg = '', sub_msg = '') {
        const contact = this.get(bare_jid);
        const { RosterContact } = _converse.exports;
        if (contact instanceof RosterContact) {
            contact.authorize().subscribe();
        } else {
            // Can happen when a subscription is retried or roster was deleted
            const nickname = sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, presence).pop()?.textContent || undefined;
            const contact = await this.addContact({
                jid: bare_jid,
                name: nickname,
                groups: [],
                subscription: 'from',
            });
            if (contact instanceof RosterContact) {
                contact.authorize(auth_msg).subscribe(sub_msg);
            }
        }
    }

    /**
     * Handle roster updates from the XMPP server.
     * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
     * @param {Element} iq - The IQ stanza received from the XMPP server.
     */
    onRosterPush(iq) {
        const id = iq.getAttribute('id');
        const from = iq.getAttribute('from');
        const bare_jid = _converse.session.get('bare_jid');
        if (from && from !== bare_jid) {
            // https://tools.ietf.org/html/rfc6121#page-15
            //
            // A receiving client MUST ignore the stanza unless it has no 'from'
            // attribute (i.e., implicitly from the bare JID of the user's
            // account) or it has a 'from' attribute whose value matches the
            // user's bare JID <user@domainpart>.
            log.warn(`Ignoring roster illegitimate roster push message from ${iq.getAttribute('from')}`);
            return;
        }
        api.send(stx`<iq type="result" id="${id}" from="${api.connection.get().jid}" xmlns="jabber:client" />`);

        const query = sizzle(`query[xmlns="${Strophe.NS.ROSTER}"]`, iq).pop();
        this.data.save('version', query.getAttribute('ver'));

        const items = sizzle(`item`, query);
        if (items.length > 1) {
            log.error(iq);
            throw new Error('Roster push query may not contain more than one "item" element.');
        }
        if (items.length === 0) {
            log.warn(iq);
            log.warn('Received a roster push stanza without an "item" element.');
            return;
        }

        this.updateContact(items.pop());
        /**
         * When the roster receives a push event from server (i.e. new entry in your contacts roster).
         * @event _converse#rosterPush
         * @type {Element}
         * @example _converse.api.listen.on('rosterPush', iq => { ... });
         */
        api.trigger('rosterPush', iq);
        return;
    }

    shouldUseRosterVersioning() {
        return (
            api.settings.get('enable_roster_versioning') &&
            this.data.get('version') &&
            api.disco.stream.getFeature('ver', 'urn:xmpp:features:rosterver')
        );
    }

    /**
     * Fetches the roster from the XMPP server and updates the local state
     * @emits _converse#roster
     * @returns {Promise}
     */
    async fetchFromServer() {
        const stanza = stx`
            <iq type="get" id="${u.getUniqueId('roster')}" xmlns="jabber:client">
                <query xmlns="${Strophe.NS.ROSTER}"
                    ${this.shouldUseRosterVersioning() ? Stanza.unsafeXML(`ver="${this.data.get('version')}"`) : ''}>
                </query>
            </iq>`;

        const iq = await api.sendIQ(stanza, null, false);

        if (iq.getAttribute('type') === 'result') {
            const query = sizzle(`query[xmlns="${Strophe.NS.ROSTER}"]`, iq).pop();
            if (query) {
                const items = sizzle(`item`, query);
                if (!this.data.get('version') && this.models.length) {
                    // We're getting the full roster, so remove all cached
                    // contacts that aren't included in it.
                    const jids = items.map(/** @param {Element} item */ (item) => item.getAttribute('jid'));
                    this.forEach((m) => !m.get('requesting') && !jids.includes(m.get('jid')) && m.destroy());
                }
                items.forEach((item) => this.updateContact(item));
                this.data.save('version', query.getAttribute('ver'));
            }
        } else if (!u.isServiceUnavailableError(iq)) {
            // Some unknown error happened, so we will try to fetch again if the page reloads.
            log.error(iq);
            log.error('Error while trying to fetch roster from the server');
            return;
        }

        _converse.session.save('roster_cached', true);
        /**
         * When the roster has been received from the XMPP server.
         * See also the `cachedRoster` event further up, which gets called instead of
         * `roster` if its already in the cache.
         * @event _converse#roster
         * @type {Element}
         * @example _converse.api.listen.on('roster', iq => { ... });
         * @example _converse.api.waitUntil('roster').then(iq => { ... });
         */
        api.trigger('roster', iq);
    }

    /**
     * Update or create RosterContact models based on the given `item` XML
     * node received in the resulting IQ stanza from the server.
     * @param {Element} item
     */
    updateContact(item) {
        const jid = item.getAttribute('jid');
        const contact = this.get(jid);
        const subscription = item.getAttribute('subscription');
        if (subscription === 'remove') {
            return contact?.destroy();
        }

        const ask = item.getAttribute('ask');
        const nickname = item.getAttribute('name');
        const groups = [...new Set(sizzle('group', item).map((e) => e.textContent))];

        if (contact) {
            // We only find out about requesting contacts via the
            // presence handler, so if we receive a contact
            // here, we know they aren't requesting anymore.
            contact.save({ subscription, ask, nickname, groups, 'requesting': null });
        } else {
            this.create({ nickname, ask, groups, jid, subscription }, { sort: false });
        }
    }

    /**
     * @param {Element} presence
     */
    createRequestingContact(presence) {
        const jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
        const nickname = sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, presence).pop()?.textContent || null;
        const user_data = {
            jid,
            subscription: 'none',
            ask: null,
            requesting: true,
            nickname: nickname,
        };
        /**
         * Triggered when someone has requested to subscribe to your presence (i.e. to be your contact).
         * @event _converse#contactRequest
         * @type {RosterContact}
         * @example _converse.api.listen.on('contactRequest', contact => { ... });
         */
        api.trigger('contactRequest', this.create(user_data));
    }

    /**
     * @param {Element} presence
     */
    handleIncomingSubscription(presence) {
        const jid = presence.getAttribute('from'),
            bare_jid = Strophe.getBareJidFromJid(jid),
            contact = this.get(bare_jid);

        if (!api.settings.get('allow_contact_requests')) {
            const { __ } = _converse;
            rejectPresenceSubscription(jid, __('This client does not allow presence subscriptions'));
        }
        if (api.settings.get('auto_subscribe')) {
            if (!contact || contact.get('subscription') !== 'to') {
                this.subscribeBack(bare_jid, presence);
            } else {
                contact.authorize();
            }
        } else {
            if (contact) {
                if (contact.get('subscription') !== 'none') {
                    contact.authorize();
                } else if (contact.get('ask') === 'subscribe') {
                    contact.authorize();
                }
            } else {
                this.createRequestingContact(presence);
            }
        }
    }

    /**
     * @param {Element} stanza
     */
    handleOwnPresence(stanza) {
        const jid = stanza.getAttribute('from');
        const resource = Strophe.getResourceFromJid(jid);
        const presence_type = stanza.getAttribute('type');
        const { profile } = _converse.state;

        if (
            api.connection.get().jid !== jid &&
            presence_type !== 'unavailable' &&
            (api.settings.get('synchronize_availability') === true ||
                api.settings.get('synchronize_availability') === resource)
        ) {
            // Another resource has changed its status and
            // synchronize_availability option set to update,
            // we'll update ours as well.
            const show = stanza.querySelector('show')?.textContent;
            profile.save({ show, presence: 'online' }, { silent: true });

            const status_message = stanza.querySelector('status')?.textContent;
            if (status_message) profile.save({ status_message });
        }
        if (_converse.session.get('jid') === jid && presence_type === 'unavailable') {
            // XXX: We've received an "unavailable" presence from our
            // own resource. Apparently this happens due to a
            // Prosody bug, whereby we send an IQ stanza to remove
            // a roster contact, and Prosody then sends
            // "unavailable" globally, instead of directed to the
            // particular user that's removed.
            //
            // Here is the bug report: https://prosody.im/issues/1121
            //
            // I'm not sure whether this might legitimately happen
            // in other cases.
            //
            // As a workaround for now we simply send our presence again,
            // otherwise we're treated as offline.
            api.user.presence.send();
        }
    }

    /**
     * @param {Element} presence
     */
    presenceHandler(presence) {
        const presence_type = presence.getAttribute('type');
        if (presence_type === 'error') return true;

        const jid = presence.getAttribute('from');
        const bare_jid = Strophe.getBareJidFromJid(jid);
        if (this.isSelf(bare_jid)) {
            return this.handleOwnPresence(presence);
        } else if (sizzle(`query[xmlns="${Strophe.NS.MUC}"]`, presence).length) {
            return; // Ignore MUC
        }

        const contact = this.get(bare_jid);

        if (contact) {
            const status = presence.querySelector('status')?.textContent;
            if (contact.get('status') !== status) contact.save({ status });
        }

        if (presence_type === 'subscribed' && contact) {
            contact.ackSubscribe();
        } else if (presence_type === 'unsubscribed' && contact) {
            contact.ackUnsubscribe();
        } else if (presence_type === 'unsubscribe') {
            return;
        } else if (presence_type === 'subscribe') {
            this.handleIncomingSubscription(presence);
        } else if (presence_type === 'unavailable' && contact) {
            const resource = Strophe.getResourceFromJid(jid);
            contact.presence.removeResource(resource);
        } else if (contact) {
            // presence_type is undefined
            contact.presence.addResource(presence);
        }
    }
}

export default RosterContacts;
