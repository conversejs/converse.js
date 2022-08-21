import RosterContact from './contact.js';
import log from "@converse/headless/log";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from "@converse/skeletor/src/model";
import { _converse, api, converse } from "@converse/headless/core";
import { initStorage } from '@converse/headless/utils/storage.js';
import { rejectPresenceSubscription } from './utils.js';

const { Strophe, $iq, sizzle, u } = converse.env;


const RosterContacts = Collection.extend({
    model: RosterContact,

    initialize () {
        const id = `roster.state-${_converse.bare_jid}-${this.get('jid')}`;
        this.state = new Model({ id, 'collapsed_groups': [] });
        initStorage(this.state, id);
        this.state.fetch();
    },

    onConnected () {
        // Called as soon as the connection has been established
        // (either after initial login, or after reconnection).
        // Use the opportunity to register stanza handlers.
        this.registerRosterHandler();
        this.registerRosterXHandler();
    },

    registerRosterHandler () {
        // Register a handler for roster IQ "set" stanzas, which update
        // roster contacts.
        _converse.connection.addHandler(iq => {
            _converse.roster.onRosterPush(iq);
            return true;
        }, Strophe.NS.ROSTER, 'iq', "set");
    },

    registerRosterXHandler () {
        // Register a handler for RosterX message stanzas, which are
        // used to suggest roster contacts to a user.
        let t = 0;
        _converse.connection.addHandler(
            function (msg) {
                window.setTimeout(
                    function () {
                        _converse.connection.flush();
                        _converse.roster.subscribeToSuggestedItems.bind(_converse.roster)(msg);
                    }, t);
                t += msg.querySelectorAll('item').length*250;
                return true;
            },
            Strophe.NS.ROSTERX, 'message', null
        );
    },

    /**
     * Fetches the roster contacts, first by trying the browser cache,
     * and if that's empty, then by querying the XMPP server.
     * @returns {promise} Promise which resolves once the contacts have been fetched.
     */
    async fetchRosterContacts () {
        const result = await new Promise((resolve, reject) => {
            this.fetch({
                'add': true,
                'silent': true,
                'success': resolve,
                'error': (_, e) => reject(e)
            });
        });
        if (u.isErrorObject(result)) {
            log.error(result);
            // Force a full roster refresh
            _converse.session.save('roster_cached', false)
            this.data.save('version', undefined);
        }

        if (_converse.session.get('roster_cached')) {
            /**
             * The contacts roster has been retrieved from the local cache (`sessionStorage`).
             * @event _converse#cachedRoster
             * @type { _converse.RosterContacts }
             * @example _converse.api.listen.on('cachedRoster', (items) => { ... });
             * @example _converse.api.waitUntil('cachedRoster').then(items => { ... });
             */
            api.trigger('cachedRoster', result);
        } else {
            _converse.send_initial_presence = true;
            return _converse.roster.fetchFromServer();
        }
    },

    subscribeToSuggestedItems (msg) {
        Array.from(msg.querySelectorAll('item')).forEach(item => {
            if (item.getAttribute('action') === 'add') {
                _converse.roster.addAndSubscribe(
                    item.getAttribute('jid'),
                    _converse.xmppstatus.getNickname() || _converse.xmppstatus.getFullname()
                );
            }
        });
        return true;
    },

    isSelf (jid) {
        return u.isSameBareJID(jid, _converse.connection.jid);
    },

    /**
     * Add a roster contact and then once we have confirmation from
     * the XMPP server we subscribe to that contact's presence updates.
     * @method _converse.RosterContacts#addAndSubscribe
     * @param { String } jid - The Jabber ID of the user being added and subscribed to.
     * @param { String } name - The name of that user
     * @param { Array.String } groups - Any roster groups the user might belong to
     * @param { String } message - An optional message to explain the reason for the subscription request.
     * @param { Object } attributes - Any additional attributes to be stored on the user's model.
     */
    async addAndSubscribe (jid, name, groups, message, attributes) {
        const contact = await this.addContactToRoster(jid, name, groups, attributes);
        if (contact instanceof _converse.RosterContact) {
            contact.subscribe(message);
        }
    },

    /**
     * Send an IQ stanza to the XMPP server to add a new roster contact.
     * @method _converse.RosterContacts#sendContactAddIQ
     * @param { String } jid - The Jabber ID of the user being added
     * @param { String } name - The name of that user
     * @param { Array.String } groups - Any roster groups the user might belong to
     * @param { Function } callback - A function to call once the IQ is returned
     * @param { Function } errback - A function to call if an error occurred
     */
    sendContactAddIQ (jid, name, groups) {
        name = name ? name : null;
        const iq = $iq({'type': 'set'})
            .c('query', {'xmlns': Strophe.NS.ROSTER})
            .c('item', { jid, name });
        groups.forEach(g => iq.c('group').t(g).up());
        return api.sendIQ(iq);
    },

    /**
     * Adds a RosterContact instance to _converse.roster and
     * registers the contact on the XMPP server.
     * Returns a promise which is resolved once the XMPP server has responded.
     * @method _converse.RosterContacts#addContactToRoster
     * @param { String } jid - The Jabber ID of the user being added and subscribed to.
     * @param { String } name - The name of that user
     * @param { Array.String } groups - Any roster groups the user might belong to
     * @param { Object } attributes - Any additional attributes to be stored on the user's model.
     */
    async addContactToRoster (jid, name, groups, attributes) {
        await api.waitUntil('rosterContactsFetched');
        groups = groups || [];
        try {
            await this.sendContactAddIQ(jid, name, groups);
        } catch (e) {
            const { __ } = _converse;
            log.error(e);
            alert(__('Sorry, there was an error while trying to add %1$s as a contact.', name || jid));
            return e;
        }
        return this.create(Object.assign({
            'ask': undefined,
            'nickname': name,
            groups,
            jid,
            'requesting': false,
            'subscription': 'none'
        }, attributes), {'sort': false});
    },

    async subscribeBack (bare_jid, presence) {
        const contact = this.get(bare_jid);
        if (contact instanceof _converse.RosterContact) {
            contact.authorize().subscribe();
        } else {
            // Can happen when a subscription is retried or roster was deleted
            const nickname = sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, presence).pop()?.textContent || null;
            const contact = await this.addContactToRoster(bare_jid, nickname, [], {'subscription': 'from'});
            if (contact instanceof _converse.RosterContact) {
                contact.authorize().subscribe();
            }
        }
    },

    /**
     * Handle roster updates from the XMPP server.
     * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
     * @method _converse.RosterContacts#onRosterPush
     * @param { XMLElement } IQ - The IQ stanza received from the XMPP server.
     */
    onRosterPush (iq) {
        const id = iq.getAttribute('id');
        const from = iq.getAttribute('from');
        if (from && from !== _converse.bare_jid) {
            // https://tools.ietf.org/html/rfc6121#page-15
            //
            // A receiving client MUST ignore the stanza unless it has no 'from'
            // attribute (i.e., implicitly from the bare JID of the user's
            // account) or it has a 'from' attribute whose value matches the
            // user's bare JID <user@domainpart>.
            log.warn(
                `Ignoring roster illegitimate roster push message from ${iq.getAttribute('from')}`
            );
            return;
        }
        api.send($iq({type: 'result', id, from: _converse.connection.jid}));

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
         * @type { XMLElement }
         * @example _converse.api.listen.on('rosterPush', iq => { ... });
         */
        api.trigger('rosterPush', iq);
        return;
    },

    rosterVersioningSupported () {
        return api.disco.stream.getFeature('ver', 'urn:xmpp:features:rosterver') && this.data.get('version');
    },

    /**
     * Fetch the roster from the XMPP server
     * @emits _converse#roster
     * @returns {promise}
     */
    async fetchFromServer () {
        const stanza = $iq({
            'type': 'get',
            'id': u.getUniqueId('roster')
        }).c('query', {xmlns: Strophe.NS.ROSTER});
        if (this.rosterVersioningSupported()) {
            stanza.attrs({'ver': this.data.get('version')});
        }

        const iq = await api.sendIQ(stanza, null, false);

        if (iq.getAttribute('type') === 'result') {
            const query = sizzle(`query[xmlns="${Strophe.NS.ROSTER}"]`, iq).pop();
            if (query) {
                const items = sizzle(`item`, query);
                if (!this.data.get('version') && this.models.length) {
                    // We're getting the full roster, so remove all cached
                    // contacts that aren't included in it.
                    const jids = items.map(item => item.getAttribute('jid'));
                    this.forEach(m => !m.get('requesting') && !jids.includes(m.get('jid')) && m.destroy());
                }
                items.forEach(item => this.updateContact(item));
                this.data.save('version', query.getAttribute('ver'));
            }
        } else if (!u.isServiceUnavailableError(iq)) {
            // Some unknown error happened, so we will try to fetch again if the page reloads.
            log.error(iq);
            log.error("Error while trying to fetch roster from the server");
            return;
        }

        _converse.session.save('roster_cached', true);
        /**
         * When the roster has been received from the XMPP server.
         * See also the `cachedRoster` event further up, which gets called instead of
         * `roster` if its already in `sessionStorage`.
         * @event _converse#roster
         * @type { XMLElement }
         * @example _converse.api.listen.on('roster', iq => { ... });
         * @example _converse.api.waitUntil('roster').then(iq => { ... });
         */
        api.trigger('roster', iq);
    },

    /**
     * Update or create RosterContact models based on the given `item` XML
     * node received in the resulting IQ stanza from the server.
     * @param { XMLElement } item
     */
    updateContact (item) {
        const jid = item.getAttribute('jid');
        const contact = this.get(jid);
        const subscription = item.getAttribute("subscription");
        if (subscription === "remove") {
            return contact?.destroy();
        }

        const ask = item.getAttribute("ask");
        const nickname = item.getAttribute('name');
        const groups = [...new Set(sizzle('group', item).map(e => e.textContent))];

        if (contact) {
            // We only find out about requesting contacts via the
            // presence handler, so if we receive a contact
            // here, we know they aren't requesting anymore.
            contact.save({ subscription, ask, nickname, groups, 'requesting': null });
        } else {
            this.create({ nickname, ask, groups, jid, subscription }, {sort: false});
        }
    },

    createRequestingContact (presence) {
        const bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
        const nickname = sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, presence).pop()?.textContent || null;
        const user_data = {
            'jid': bare_jid,
            'subscription': 'none',
            'ask': null,
            'requesting': true,
            'nickname': nickname
        };
        /**
         * Triggered when someone has requested to subscribe to your presence (i.e. to be your contact).
         * @event _converse#contactRequest
         * @type { _converse.RosterContact }
         * @example _converse.api.listen.on('contactRequest', contact => { ... });
         */
        api.trigger('contactRequest', this.create(user_data));
    },

    handleIncomingSubscription (presence) {
        const jid = presence.getAttribute('from'),
            bare_jid = Strophe.getBareJidFromJid(jid),
            contact = this.get(bare_jid);

        if (!api.settings.get('allow_contact_requests')) {
            const { __ } = _converse;
            rejectPresenceSubscription(
                jid,
                __("This client does not allow presence subscriptions")
            );
        }
        if (api.settings.get('auto_subscribe')) {
            if ((!contact) || (contact.get('subscription') !== 'to')) {
                this.subscribeBack(bare_jid, presence);
            } else {
                contact.authorize();
            }
        } else {
            if (contact) {
                if (contact.get('subscription') !== 'none')  {
                    contact.authorize();
                } else if (contact.get('ask') === "subscribe") {
                    contact.authorize();
                }
            } else {
                this.createRequestingContact(presence);
            }
        }
    },

    handleOwnPresence (presence) {
        const jid = presence.getAttribute('from'),
              resource = Strophe.getResourceFromJid(jid),
              presence_type = presence.getAttribute('type');

        if ((_converse.connection.jid !== jid) &&
                (presence_type !== 'unavailable') &&
                (api.settings.get('synchronize_availability') === true ||
                 api.settings.get('synchronize_availability') === resource)) {
            // Another resource has changed its status and
            // synchronize_availability option set to update,
            // we'll update ours as well.
            const show = presence.querySelector('show')?.textContent || 'online';
            _converse.xmppstatus.save({'status': show}, {'silent': true});

            const status_message = presence.querySelector('status')?.textContent;
            if (status_message) {
                _converse.xmppstatus.save({'status_message': status_message});
            }
        }
        if (_converse.jid === jid && presence_type === 'unavailable') {
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
    },

    presenceHandler (presence) {
        const presence_type = presence.getAttribute('type');
        if (presence_type === 'error') return true;

        const jid = presence.getAttribute('from');
        const bare_jid = Strophe.getBareJidFromJid(jid);
        if (this.isSelf(bare_jid)) {
            return this.handleOwnPresence(presence);
        } else if (sizzle(`query[xmlns="${Strophe.NS.MUC}"]`, presence).length) {
            return; // Ignore MUC
        }

        const status_message = presence.querySelector('status')?.textContent;
        const contact = this.get(bare_jid);

        if (contact && (status_message !== contact.get('status'))) {
            contact.save({'status': status_message});
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
});

export default RosterContacts;
