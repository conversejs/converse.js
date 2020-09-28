/**
 * @module converse-roster
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/converse-status";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from '@converse/skeletor/src/model.js';
import { invoke, isEmpty, isNaN, isString, propertyOf, sum } from "lodash-es";
import { _converse, api, converse } from "@converse/headless/converse-core";
import log from "./log";

const { Strophe, $iq, $pres, dayjs, sizzle } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-roster', {

    dependencies: ['converse-status'],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { __ } = _converse;

        api.settings.extend({
            'allow_contact_requests': true,
            'auto_subscribe': false,
            'synchronize_availability': true,
        });

        api.promises.add([
            'cachedRoster',
            'roster',
            'rosterContactsFetched',
            'rosterGroupsFetched',
            'rosterInitialized',
        ]);

        _converse.HEADER_CURRENT_CONTACTS =  __('My contacts');
        _converse.HEADER_PENDING_CONTACTS = __('Pending contacts');
        _converse.HEADER_REQUESTING_CONTACTS = __('Contact requests');
        _converse.HEADER_UNGROUPED = __('Ungrouped');
        _converse.HEADER_UNREAD = __('New messages');

        const HEADER_WEIGHTS = {};
        HEADER_WEIGHTS[_converse.HEADER_UNREAD] = 0;
        HEADER_WEIGHTS[_converse.HEADER_REQUESTING_CONTACTS] = 1;
        HEADER_WEIGHTS[_converse.HEADER_CURRENT_CONTACTS]    = 2;
        HEADER_WEIGHTS[_converse.HEADER_UNGROUPED]           = 3;
        HEADER_WEIGHTS[_converse.HEADER_PENDING_CONTACTS]    = 4;


        _converse.registerPresenceHandler = function () {
            _converse.unregisterPresenceHandler();
            _converse.presence_ref = _converse.connection.addHandler(presence => {
                    _converse.roster.presenceHandler(presence);
                    return true;
                }, null, 'presence', null);
        };


        /**
         * Reject or cancel another user's subscription to our presence updates.
         * @method rejectPresenceSubscription
         * @private
         * @memberOf _converse
         * @param { String } jid - The Jabber ID of the user whose subscription is being canceled
         * @param { String } message - An optional message to the user
         */
        _converse.rejectPresenceSubscription = function (jid, message) {
            const pres = $pres({to: jid, type: "unsubscribed"});
            if (message && message !== "") { pres.c("status").t(message); }
            api.send(pres);
        };


        _converse.sendInitialPresence = function () {
            if (_converse.send_initial_presence) {
                api.user.presence.send();
            }
        };


        /**
         * Fetch all the roster groups, and then the roster contacts.
         * Emit an event after fetching is done in each case.
         * @private
         * @method _converse.populateRoster
         * @param { Bool } ignore_cache - If set to to true, the local cache
         *      will be ignored it's guaranteed that the XMPP server
         *      will be queried for the roster.
         */
        _converse.populateRoster = async function (ignore_cache=false) {
            if (ignore_cache) {
                _converse.send_initial_presence = true;
            }
            try {
                await _converse.rostergroups.fetchRosterGroups();
                /**
                 * Triggered once roster groups have been fetched. Used by the
                 * `converse-rosterview.js` plugin to know when it can start alphabetically
                 * position roster groups.
                 * @event _converse#rosterGroupsFetched
                 * @example _converse.api.listen.on('rosterGroupsFetched', () => { ... });
                 * @example _converse.api.waitUntil('rosterGroupsFetched').then(() => { ... });
                 */
                api.trigger('rosterGroupsFetched');
                await _converse.roster.fetchRosterContacts();
                api.trigger('rosterContactsFetched');
            } catch (reason) {
                log.error(reason);
            } finally {
                _converse.sendInitialPresence();
            }
        };

        const Resource = Model.extend({'idAttribute': 'name'});
        const Resources = Collection.extend({'model': Resource});


        _converse.Presence = Model.extend({
            defaults: {
                'show': 'offline'
            },

            initialize () {
                this.resources = new Resources();
                const id = `converse.identities-${this.get('jid')}`;
                this.resources.browserStorage = _converse.createStore(id, "session");
                this.listenTo(this.resources, 'update', this.onResourcesChanged);
                this.listenTo(this.resources, 'change', this.onResourcesChanged);
            },

            onResourcesChanged () {
                const hpr = this.getHighestPriorityResource();
                const show = hpr?.attributes?.show || 'offline';
                if (this.get('show') !== show) {
                    this.save({'show': show});
                }
            },

            /**
             * Return the resource with the highest priority.
             * If multiple resources have the same priority, take the latest one.
             * @private
             */
            getHighestPriorityResource () {
                return this.resources.sortBy(r => `${r.get('priority')}-${r.get('timestamp')}`).reverse()[0];
            },

            /**
             * Adds a new resource and it's associated attributes as taken
             * from the passed in presence stanza.
             * Also updates the presence if the resource has higher priority (and is newer).
             * @private
             * @param { XMLElement } presence: The presence stanza
             */
            addResource (presence) {
                const jid = presence.getAttribute('from'),
                      name = Strophe.getResourceFromJid(jid),
                      delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, presence).pop(),
                      priority = propertyOf(presence.querySelector('priority'))('textContent') || 0,
                      resource = this.resources.get(name),
                      settings = {
                          'name': name,
                          'priority': isNaN(parseInt(priority, 10)) ? 0 : parseInt(priority, 10),
                          'show': propertyOf(presence.querySelector('show'))('textContent') || 'online',
                          'timestamp': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : (new Date()).toISOString()
                       };
                if (resource) {
                    resource.save(settings);
                } else {
                    this.resources.create(settings);
                }
            },

            /**
             * Remove the passed in resource from the resources map.
             * Also redetermines the presence given that there's one less
             * resource.
             * @private
             * @param { string } name: The resource name
             */
            removeResource (name) {
                const resource = this.resources.get(name);
                if (resource) {
                    resource.destroy();
                }
            }
        });


        _converse.Presences = Collection.extend({
            model: _converse.Presence,
        });


        /**
         * @class
         * @namespace _converse.RosterContact
         * @memberOf _converse
         */
        _converse.RosterContact = Model.extend({
            defaults: {
                'chat_state': undefined,
                'image': _converse.DEFAULT_IMAGE,
                'image_type': _converse.DEFAULT_IMAGE_TYPE,
                'num_unread': 0,
                'status': undefined,
            },

            async initialize (attributes) {
                this.initialized = u.getResolveablePromise();
                this.setPresence();
                const { jid } = attributes;
                const bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase();
                attributes.jid = bare_jid;
                this.set(Object.assign({
                    'groups': [],
                    'id': bare_jid,
                    'jid': bare_jid,
                    'user_id': Strophe.getNodeFromJid(jid)
                }, attributes));
                /**
                 * When a contact's presence status has changed.
                 * The presence status is either `online`, `offline`, `dnd`, `away` or `xa`.
                 * @event _converse#contactPresenceChanged
                 * @type { _converse.RosterContact }
                 * @example _converse.api.listen.on('contactPresenceChanged', contact => { ... });
                 */
                this.listenTo(this.presence, 'change:show', () => api.trigger('contactPresenceChanged', this));
                this.listenTo(this.presence, 'change:show', () => this.trigger('presenceChanged'));
                /**
                 * Synchronous event which provides a hook for further initializing a RosterContact
                 * @event _converse#rosterContactInitialized
                 * @param { _converse.RosterContact } contact
                 */
                await api.trigger('rosterContactInitialized', this, {'Synchronous': true});
                this.initialized.resolve();
            },

            setPresence () {
                const jid = this.get('jid');
                this.presence = _converse.presences.findWhere({'jid': jid}) || _converse.presences.create({'jid': jid});
            },

            openChat () {
                const attrs = this.attributes;
                api.chats.open(attrs.jid, attrs, true);
            },

            /**
             * Return a string of tab-separated values that are to be used when
             * matching against filter text.
             *
             * The goal is to be able to filter against the VCard fullname,
             * roster nickname and JID.
             * @returns { String } Lower-cased, tab-separated values
             */
            getFilterCriteria () {
                const nick = this.get('nickname');
                const jid = this.get('jid');
                let criteria = this.getDisplayName();
                criteria = !criteria.includes(jid) ? criteria.concat(`   ${jid}`) : criteria;
                criteria = !criteria.includes(nick) ? criteria.concat(`   ${nick}`) : criteria;
                return criteria.toLowerCase();
            },

            getDisplayName () {
                // Gets overridden in converse-vcard where the fullname is may be returned
                if (this.get('nickname')) {
                    return this.get('nickname');
                } else {
                    return this.get('jid');
                }
            },

            getFullname () {
                // Gets overridden in converse-vcard where the fullname may be returned
                return this.get('jid');
            },

            /**
             * Send a presence subscription request to this roster contact
             * @private
             * @method _converse.RosterContacts#subscribe
             * @param { String } message - An optional message to explain the
             *      reason for the subscription request.
             */
            subscribe (message) {
                const pres = $pres({to: this.get('jid'), type: "subscribe"});
                if (message && message !== "") {
                    pres.c("status").t(message).up();
                }
                const nick = _converse.xmppstatus.getNickname() || _converse.xmppstatus.getFullname();
                if (nick) {
                    pres.c('nick', {'xmlns': Strophe.NS.NICK}).t(nick).up();
                }
                api.send(pres);
                this.save('ask', "subscribe"); // ask === 'subscribe' Means we have asked to subscribe to them.
                return this;
            },

            /**
             * Upon receiving the presence stanza of type "subscribed",
             * the user SHOULD acknowledge receipt of that subscription
             * state notification by sending a presence stanza of type
             * "subscribe" to the contact
             * @private
             * @method _converse.RosterContacts#ackSubscribe
             */
            ackSubscribe () {
                api.send($pres({
                    'type': 'subscribe',
                    'to': this.get('jid')
                }));
            },

            /**
             * Upon receiving the presence stanza of type "unsubscribed",
             * the user SHOULD acknowledge receipt of that subscription state
             * notification by sending a presence stanza of type "unsubscribe"
             * this step lets the user's server know that it MUST no longer
             * send notification of the subscription state change to the user.
             * @private
             * @method _converse.RosterContacts#ackUnsubscribe
             * @param { String } jid - The Jabber ID of the user who is unsubscribing
             */
            ackUnsubscribe () {
                api.send($pres({'type': 'unsubscribe', 'to': this.get('jid')}));
                this.removeFromRoster();
                this.destroy();
            },

            /**
             * Unauthorize this contact's presence subscription
             * @private
             * @method _converse.RosterContacts#unauthorize
             * @param { String } message - Optional message to send to the person being unauthorized
             */
            unauthorize (message) {
                _converse.rejectPresenceSubscription(this.get('jid'), message);
                return this;
            },

            /**
             * Authorize presence subscription
             * @private
             * @method _converse.RosterContacts#authorize
             * @param { String } message - Optional message to send to the person being authorized
             */
            authorize (message) {
                const pres = $pres({'to': this.get('jid'), 'type': "subscribed"});
                if (message && message !== "") {
                    pres.c("status").t(message);
                }
                api.send(pres);
                return this;
            },

            /**
             * Instruct the XMPP server to remove this contact from our roster
             * @private
             * @method _converse.RosterContacts#
             * @returns { Promise }
             */
            removeFromRoster () {
                const iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', {jid: this.get('jid'), subscription: "remove"});
                return api.sendIQ(iq);
            }
        });

        /**
         * @class
         * @namespace _converse.RosterContacts
         * @memberOf _converse
         */
        _converse.RosterContacts = Collection.extend({
            model: _converse.RosterContact,

            comparator (contact1, contact2) {
                // Groups are sorted alphabetically, ignoring case.
                // However, Ungrouped, Requesting Contacts and Pending Contacts
                // appear last and in that order.
                const status1 = contact1.presence.get('show') || 'offline';
                const status2 = contact2.presence.get('show') || 'offline';
                if (_converse.STATUS_WEIGHTS[status1] === _converse.STATUS_WEIGHTS[status2]) {
                    const name1 = (contact1.getDisplayName()).toLowerCase();
                    const name2 = (contact2.getDisplayName()).toLowerCase();
                    return name1 < name2 ? -1 : (name1 > name2? 1 : 0);
                } else  {
                    return _converse.STATUS_WEIGHTS[status1] < _converse.STATUS_WEIGHTS[status2] ? -1 : 1;
                }
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
             * @private
             * @returns {promise} Promise which resolves once the contacts have been fetched.
             */
            async fetchRosterContacts () {
                const result = await new Promise((resolve, reject) => {
                    this.fetch({
                        'add': true,
                        'silent': true,
                        'success': resolve,
                        'error': (c, e) => reject(e)
                    });
                });
                if (u.isErrorObject(result)) {
                    log.error(result);
                    // Force a full roster refresh
                    _converse.session.set('roster_cached', false)
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
             * @private
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
             * @private
             * @method _converse.RosterContacts#sendContactAddIQ
             * @param { String } jid - The Jabber ID of the user being added
             * @param { String } name - The name of that user
             * @param { Array.String } groups - Any roster groups the user might belong to
             * @param { Function } callback - A function to call once the IQ is returned
             * @param { Function } errback - A function to call if an error occurred
             */
            sendContactAddIQ (jid, name, groups) {
                name = isEmpty(name) ? null : name;
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
             * @private
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

            getNumOnlineContacts () {
                const ignored = ['offline', 'unavailable'];
                return sum(this.models.filter(m => !ignored.includes(m.presence.get('show'))));
            },

            /**
             * Handle roster updates from the XMPP server.
             * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
             * @private
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
             * @private
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
                if (iq.getAttribute('type') !== 'error') {
                    const query = sizzle(`query[xmlns="${Strophe.NS.ROSTER}"]`, iq).pop();
                    if (query) {
                        const items = sizzle(`item`, query);
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

            /* Update or create RosterContact models based on the given `item` XML
             * node received in the resulting IQ stanza from the server.
             * @private
             * @param { XMLElement } item
             */
            updateContact (item) {
                const jid = item.getAttribute('jid');

                const contact = this.get(jid);
                const subscription = item.getAttribute("subscription");
                const ask = item.getAttribute("ask");
                const groups = Array.from(item.getElementsByTagName('group')).map(e => e.textContent);
                if (!contact) {
                    if ((subscription === "none" && ask === null) || (subscription === "remove")) {
                        return; // We're lazy when adding contacts.
                    }
                    this.create({
                        'ask': ask,
                        'nickname': item.getAttribute("name"),
                        'groups': groups,
                        'jid': jid,
                        'subscription': subscription
                    }, {sort: false});
                } else {
                    if (subscription === "remove") {
                        return contact.destroy();
                    }
                    // We only find out about requesting contacts via the
                    // presence handler, so if we receive a contact
                    // here, we know they aren't requesting anymore.
                    // see docs/DEVELOPER.rst
                    contact.save({
                        'subscription': subscription,
                        'ask': ask,
                        'nickname': item.getAttribute("name"),
                        'requesting': null,
                        'groups': groups
                    });
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
                    _converse.rejectPresenceSubscription(
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
                    const show = propertyOf(presence.querySelector('show'))('textContent') || 'online';
                    _converse.xmppstatus.save({'status': show}, {'silent': true});

                    const status_message = propertyOf(presence.querySelector('status'))('textContent');
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
                if (presence_type === 'error') { return true; }

                const jid = presence.getAttribute('from'),
                      bare_jid = Strophe.getBareJidFromJid(jid);
                if (this.isSelf(bare_jid)) {
                    return this.handleOwnPresence(presence);
                } else if (sizzle(`query[xmlns="${Strophe.NS.MUC}"]`, presence).length) {
                    return; // Ignore MUC
                }

                const status_message = propertyOf(presence.querySelector('status'))('textContent'),
                      contact = this.get(bare_jid);

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


        _converse.RosterGroup = Model.extend({

            initialize (attributes) {
                this.set(Object.assign({
                    description: __('Click to hide these contacts'),
                    state: _converse.OPENED
                }, attributes));
                // Collection of contacts belonging to this group.
                this.contacts = new _converse.RosterContacts();
            }
        });


        /**
         * @class
         * @namespace _converse.RosterGroups
         * @memberOf _converse
         */
        _converse.RosterGroups = Collection.extend({
            model: _converse.RosterGroup,

            comparator (a, b) {
                a = a.get('name');
                b = b.get('name');
                const WEIGHTS =  HEADER_WEIGHTS;
                const special_groups = Object.keys(HEADER_WEIGHTS);
                const a_is_special = special_groups.includes(a);
                const b_is_special = special_groups.includes(b);
                if (!a_is_special && !b_is_special ) {
                    return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                } else if (a_is_special && b_is_special) {
                    return WEIGHTS[a] < WEIGHTS[b] ? -1 : (WEIGHTS[a] > WEIGHTS[b] ? 1 : 0);
                } else if (!a_is_special && b_is_special) {
                    const a_header = _converse.HEADER_CURRENT_CONTACTS;
                    return WEIGHTS[a_header] < WEIGHTS[b] ? -1 : (WEIGHTS[a_header] > WEIGHTS[b] ? 1 : 0);
                } else if (a_is_special && !b_is_special) {
                    const b_header = _converse.HEADER_CURRENT_CONTACTS;
                    return WEIGHTS[a] < WEIGHTS[b_header] ? -1 : (WEIGHTS[a] > WEIGHTS[b_header] ? 1 : 0);
                }
            },

            /**
             * Fetches all the roster groups from sessionStorage.
             * @private
             * @method _converse.RosterGroups#fetchRosterGroups
             * @returns { Promise } - A promise which resolves once the groups have been fetched.
             */
            fetchRosterGroups () {
                return new Promise(success => {
                    this.fetch({
                        success,
                        // We need to first have all groups before
                        // we can start positioning them, so we set
                        // 'silent' to true.
                        silent: true,
                    });
                });
            }
        });

        _converse.unregisterPresenceHandler = function () {
            if (_converse.presence_ref !== undefined) {
                _converse.connection.deleteHandler(_converse.presence_ref);
                delete _converse.presence_ref;
            }
        };


        /******************** Event Handlers ********************/

        function updateUnreadCounter (chatbox) {
            const contact = _converse.roster && _converse.roster.findWhere({'jid': chatbox.get('jid')});
            if (contact !== undefined) {
                contact.save({'num_unread': chatbox.get('num_unread')});
            }
        }

        api.listen.on('chatBoxesInitialized', () => {
            _converse.chatboxes.on('change:num_unread', updateUnreadCounter);

            _converse.chatboxes.on('add', chatbox => {
                if (chatbox.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                    chatbox.setRosterContact(chatbox.get('jid'));
                }
            });
        });

        api.listen.on('beforeTearDown', () => _converse.unregisterPresenceHandler());

        api.waitUntil('rosterContactsFetched').then(() => {
            _converse.roster.on('add', (contact) => {
                /* When a new contact is added, check if we already have a
                 * chatbox open for it, and if so attach it to the chatbox.
                 */
                const chatbox = _converse.chatboxes.findWhere({'jid': contact.get('jid')});
                if (chatbox) {
                    chatbox.setRosterContact(contact.get('jid'));
                }
            });
        });

        async function clearPresences () {
            _converse.presences && await _converse.presences.clearStore();
        }

        api.listen.on('streamResumptionFailed', () => _converse.session.set('roster_cached', false));

        api.listen.on('clearSession', async () => {
            await clearPresences();
            if (_converse.shouldClearCache()) {
                if (_converse.rostergroups) {
                    await _converse.rostergroups.clearStore();
                    delete _converse.rostergroups;
                }
                if (_converse.roster) {
                    invoke(_converse, 'roster.data.destroy');
                    await _converse.roster.clearStore();
                    delete _converse.roster;
                }
            }
        });

        api.listen.on('statusInitialized', async reconnecting => {
            if (reconnecting) {
                // When reconnecting and not resuming a previous session,
                // we clear all cached presence data, since it might be stale
                // and we'll receive new presence updates
                !_converse.connection.hasResumed() && await clearPresences();
            } else {
                _converse.presences = new _converse.Presences();
                const id = `converse.presences-${_converse.bare_jid}`;
                _converse.presences.browserStorage = _converse.createStore(id, "session");
                // We might be continuing an existing session, so we fetch
                // cached presence data.
                _converse.presences.fetch();
            }
            /**
             * Triggered once the _converse.Presences collection has been
             * initialized and its cached data fetched.
             * Returns a boolean indicating whether this event has fired due to
             * Converse having reconnected.
             * @event _converse#presencesInitialized
             * @type { bool }
             * @example _converse.api.listen.on('presencesInitialized', reconnecting => { ... });
             */
            api.trigger('presencesInitialized', reconnecting);
        });


        async function initRoster () {
            // Initialize the Bakcbone collections that represent the contats
            // roster and the roster groups.
            await api.waitUntil('VCardsInitialized');
            _converse.roster = new _converse.RosterContacts();
            let id = `converse.contacts-${_converse.bare_jid}`;
            _converse.roster.browserStorage = _converse.createStore(id);

            _converse.roster.data = new Model();
            id = `converse-roster-model-${_converse.bare_jid}`;
            _converse.roster.data.id = id;
            _converse.roster.data.browserStorage = _converse.createStore(id);
            _converse.roster.data.fetch();

            id = `converse.roster.groups${_converse.bare_jid}`;
            _converse.rostergroups = new _converse.RosterGroups();
            _converse.rostergroups.browserStorage = _converse.createStore(id);
            /**
             * Triggered once the `_converse.RosterContacts` and `_converse.RosterGroups` have
             * been created, but not yet populated with data.
             * This event is useful when you want to create views for these collections.
             * @event _converse#chatBoxMaximized
             * @example _converse.api.listen.on('rosterInitialized', () => { ... });
             * @example _converse.api.waitUntil('rosterInitialized').then(() => { ... });
             */
            api.trigger('rosterInitialized');
        }

        api.listen.on('presencesInitialized', async (reconnecting) => {
            if (reconnecting) {
                /**
                 * Similar to `rosterInitialized`, but instead pertaining to reconnection.
                 * This event indicates that the roster and its groups are now again
                 * available after Converse.js has reconnected.
                 * @event _converse#rosterReadyAfterReconnection
                 * @example _converse.api.listen.on('rosterReadyAfterReconnection', () => { ... });
                 */
                api.trigger('rosterReadyAfterReconnection');
            } else {
                await initRoster();
            }
            _converse.roster.onConnected();
            _converse.registerPresenceHandler();
            _converse.populateRoster(!_converse.connection.restored);
        });


        /************************ API ************************/
        // API methods only available to plugins

        Object.assign(_converse.api, {
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
                    } else if (isString(jids)) {
                        return _getter(jids);
                    }
                    return jids.map(_getter);
                },

                /**
                 * Add a contact.
                 *
                 * @method _converse.api.contacts.add
                 * @param {string} jid The JID of the contact to be added
                 * @param {string} [name] A custom name to show the user by
                 *     in the roster.
                 * @example
                 *     _converse.api.contacts.add('buddy@example.com')
                 * @example
                 *     _converse.api.contacts.add('buddy@example.com', 'Buddy')
                 */
                async add (jid, name) {
                    await api.waitUntil('rosterContactsFetched');
                    if (!isString(jid) || !jid.includes('@')) {
                        throw new TypeError('contacts.add: invalid jid');
                    }
                    return _converse.roster.addAndSubscribe(jid, isEmpty(name)? jid: name);
                }
            }
        });
    }
});

