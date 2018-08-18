// Converse.js
// http://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define(["converse-core"], factory);
}(this, function (converse) {
    "use strict";
    const { Backbone, Promise, Strophe, $iq, $pres, b64_sha1, moment, sizzle, _ } = converse.env;
    const u = converse.env.utils;

    converse.plugins.add('converse-roster', {

        dependencies: ["converse-vcard"],

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                  { __ } = _converse;

            _converse.api.settings.update({
                'allow_contact_requests': true,
                'auto_subscribe': false,
                'synchronize_availability': true,
            });

            _converse.api.promises.add([
                'cachedRoster',
                'roster',
                'rosterContactsFetched',
                'rosterGroupsFetched',
                'rosterInitialized',
            ]);


            _converse.registerPresenceHandler = function () {
                _converse.unregisterPresenceHandler();
                _converse.presence_ref = _converse.connection.addHandler(
                    function (presence) {
                        _converse.roster.presenceHandler(presence);
                        return true;
                    }, null, 'presence', null);
            };


            _converse.initRoster = function () {
                /* Initialize the Bakcbone collections that represent the contats
                * roster and the roster groups.
                */
                _converse.roster = new _converse.RosterContacts();
                _converse.roster.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                    b64_sha1(`converse.contacts-${_converse.bare_jid}`));

                _converse.roster.data = new Backbone.Model();
                const id = b64_sha1(`converse-roster-model-${_converse.bare_jid}`);
                _converse.roster.data.id = id;
                _converse.roster.data.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
                _converse.roster.data.fetch();

                _converse.rostergroups = new _converse.RosterGroups();
                _converse.rostergroups.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                    b64_sha1(`converse.roster.groups${_converse.bare_jid}`));
                _converse.emit('rosterInitialized');
            };


            _converse.populateRoster = function (ignore_cache=false) {
                /* Fetch all the roster groups, and then the roster contacts.
                 * Emit an event after fetching is done in each case.
                 *
                 * Parameters:
                 *    (Bool) ignore_cache - If set to to true, the local cache
                 *      will be ignored it's guaranteed that the XMPP server
                 *      will be queried for the roster.
                 */
                if (ignore_cache) {
                    _converse.send_initial_presence = true;
                    _converse.roster.fetchFromServer()
                        .then(() => {
                            _converse.emit('rosterContactsFetched');
                            _converse.sendInitialPresence();
                        }).catch((reason) => {
                            _converse.log(reason, Strophe.LogLevel.ERROR);
                            _converse.sendInitialPresence();
                        });
                } else {
                    _converse.rostergroups.fetchRosterGroups().then(() => {
                        _converse.emit('rosterGroupsFetched');
                        return _converse.roster.fetchRosterContacts();
                    }).then(() => {
                        _converse.emit('rosterContactsFetched');
                        _converse.sendInitialPresence();
                    }).catch((reason) => {
                        _converse.log(reason, Strophe.LogLevel.ERROR);
                        _converse.sendInitialPresence();
                    });
                }
            };


            _converse.Presence = Backbone.Model.extend({
                defaults () {
                    return {
                        'show': 'offline',
                        'resources': {}
                    }
                },

                getHighestPriorityResource () {
                    /* Return the resource with the highest priority.
                     *
                     * If multiple resources have the same priority, take the
                     * latest one.
                     */
                    const resources = this.get('resources');
                    if (_.isObject(resources) && _.size(resources)) {
                        const val = _.flow(
                                _.values,
                                _.partial(_.sortBy, _, ['priority', 'timestamp']),
                                _.reverse
                            )(resources)[0];
                        if (!_.isUndefined(val)) {
                            return val;
                        }
                    }
                },

                addResource (presence) {
                    /* Adds a new resource and it's associated attributes as taken
                     * from the passed in presence stanza.
                     *
                     * Also updates the presence if the resource has higher priority (and is newer).
                     */
                    const jid = presence.getAttribute('from'),
                          show = _.propertyOf(presence.querySelector('show'))('textContent') || 'online',
                          resource = Strophe.getResourceFromJid(jid),
                          delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, presence).pop(),
                          timestamp = _.isNil(delay) ? moment().format() : moment(delay.getAttribute('stamp')).format();

                    let priority = _.propertyOf(presence.querySelector('priority'))('textContent') || 0;
                    priority = _.isNaN(parseInt(priority, 10)) ? 0 : parseInt(priority, 10);

                    const resources = _.isObject(this.get('resources')) ? this.get('resources') : {};
                    resources[resource] = {
                        'name': resource,
                        'priority': priority,
                        'show': show,
                        'timestamp': timestamp
                    };
                    const changed = {'resources': resources};
                    const hpr = this.getHighestPriorityResource();
                    if (priority == hpr.priority && timestamp == hpr.timestamp) {
                        // Only set the "global" presence if this is the newest resource
                        // with the highest priority
                        changed.show = show;
                    }
                    this.save(changed);
                    return resources;
                },


                removeResource (resource) {
                    /* Remove the passed in resource from the resources map.
                     *
                     * Also redetermines the presence given that there's one less
                     * resource.
                     */
                    let resources = this.get('resources');
                    if (!_.isObject(resources)) {
                        resources = {};
                    } else {
                        delete resources[resource];
                    }
                    this.save({
                        'resources': resources,
                        'show': _.propertyOf(
                            this.getHighestPriorityResource())('show') || 'offline'
                    });
                },

            });


            _converse.Presences = Backbone.Collection.extend({
                model: _converse.Presence,
            });


            _converse.ModelWithVCardAndPresence = Backbone.Model.extend({
                initialize () {
                    this.setVCard();
                    this.setPresence();
                },

                setVCard () {
                    const jid = this.get('jid');
                    this.vcard = _converse.vcards.findWhere({'jid': jid}) || _converse.vcards.create({'jid': jid});
                },

                setPresence () {
                    const jid = this.get('jid');
                    this.presence = _converse.presences.findWhere({'jid': jid}) || _converse.presences.create({'jid': jid});
                }
            });


            _converse.RosterContact = _converse.ModelWithVCardAndPresence.extend({
                defaults: {
                    'chat_state': undefined,
                    'image': _converse.DEFAULT_IMAGE,
                    'image_type': _converse.DEFAULT_IMAGE_TYPE,
                    'num_unread': 0,
                    'status': '',
                },

                initialize (attributes) {
                    _converse.ModelWithVCardAndPresence.prototype.initialize.apply(this, arguments);

                    const { jid } = attributes,
                        bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase(),
                        resource = Strophe.getResourceFromJid(jid);

                    attributes.jid = bare_jid;
                    this.set(_.assignIn({
                        'groups': [],
                        'id': bare_jid,
                        'jid': bare_jid,
                        'user_id': Strophe.getNodeFromJid(jid)
                    }, attributes));

                    this.setChatBox();

                    this.presence.on('change:show', () => _converse.emit('contactPresenceChanged', this));
                    this.presence.on('change:show', () => this.trigger('presenceChanged'));
                },

                setChatBox (chatbox=null) {
                    chatbox = chatbox || _converse.chatboxes.get(this.get('jid'));
                    if (chatbox) {
                        this.chatbox = chatbox;
                        this.chatbox.on('change:hidden', this.render, this);
                    }
                },

                getDisplayName () {
                    return this.get('nickname') || this.vcard.get('nickname') || this.vcard.get('fullname') || this.get('jid');
                },

                getFullname () {
                    return this.vcard.get('fullname');
                },

                subscribe (message) {
                    /* Send a presence subscription request to this roster contact
                    *
                    * Parameters:
                    *    (String) message - An optional message to explain the
                    *      reason for the subscription request.
                    */
                    const pres = $pres({to: this.get('jid'), type: "subscribe"});
                    if (message && message !== "") {
                        pres.c("status").t(message).up();
                    }
                    const nick = _converse.xmppstatus.vcard.get('nickname') || _converse.xmppstatus.vcard.get('fullname');
                    if (nick) {
                        pres.c('nick', {'xmlns': Strophe.NS.NICK}).t(nick).up();
                    }
                    _converse.connection.send(pres);
                    this.save('ask', "subscribe"); // ask === 'subscribe' Means we have asked to subscribe to them.
                    return this;
                },

                ackSubscribe () {
                    /* Upon receiving the presence stanza of type "subscribed",
                    * the user SHOULD acknowledge receipt of that subscription
                    * state notification by sending a presence stanza of type
                    * "subscribe" to the contact
                    */
                    _converse.connection.send($pres({
                        'type': 'subscribe',
                        'to': this.get('jid')
                    }));
                },

                ackUnsubscribe () {
                    /* Upon receiving the presence stanza of type "unsubscribed",
                    * the user SHOULD acknowledge receipt of that subscription state
                    * notification by sending a presence stanza of type "unsubscribe"
                    * this step lets the user's server know that it MUST no longer
                    * send notification of the subscription state change to the user.
                    *  Parameters:
                    *    (String) jid - The Jabber ID of the user who is unsubscribing
                    */
                    _converse.connection.send($pres({'type': 'unsubscribe', 'to': this.get('jid')}));
                    this.removeFromRoster();
                    this.destroy();
                },

                unauthorize (message) {
                    /* Unauthorize this contact's presence subscription
                    * Parameters:
                    *   (String) message - Optional message to send to the person being unauthorized
                    */
                    _converse.rejectPresenceSubscription(this.get('jid'), message);
                    return this;
                },

                authorize (message) {
                    /* Authorize presence subscription
                    * Parameters:
                    *   (String) message - Optional message to send to the person being authorized
                    */
                    const pres = $pres({'to': this.get('jid'), 'type': "subscribed"});
                    if (message && message !== "") {
                        pres.c("status").t(message);
                    }
                    _converse.connection.send(pres);
                    return this;
                },

                removeFromRoster (callback, errback) {
                    /* Instruct the XMPP server to remove this contact from our roster
                    * Parameters:
                    *   (Function) callback
                    */
                    const iq = $iq({type: 'set'})
                        .c('query', {xmlns: Strophe.NS.ROSTER})
                        .c('item', {jid: this.get('jid'), subscription: "remove"});
                    _converse.connection.sendIQ(iq, callback, errback);
                    return this;
                }
            });


            _converse.RosterContacts = Backbone.Collection.extend({
                model: _converse.RosterContact,

                comparator (contact1, contact2) {
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
                    /* Called as soon as the connection has been established
                     * (either after initial login, or after reconnection).
                     *
                     * Use the opportunity to register stanza handlers.
                     */
                    this.registerRosterHandler();
                    this.registerRosterXHandler();
                },

                registerRosterHandler () {
                    /* Register a handler for roster IQ "set" stanzas, which update
                     * roster contacts.
                     */
                    _converse.connection.addHandler((iq) => {
                        _converse.roster.onRosterPush(iq);
                        return true;
                    }, Strophe.NS.ROSTER, 'iq', "set");
                },

                registerRosterXHandler () {
                    /* Register a handler for RosterX message stanzas, which are
                     * used to suggest roster contacts to a user.
                     */
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

                fetchRosterContacts () {
                    /* Fetches the roster contacts, first by trying the
                     * sessionStorage cache, and if that's empty, then by querying
                     * the XMPP server.
                     *
                     * Returns a promise which resolves once the contacts have been
                     * fetched.
                     */
                    const that = this;
                    return new Promise((resolve, reject) => {
                        this.fetch({
                            'add': true,
                            'silent': true,
                            success (collection) {
                                if (collection.length === 0 || 
                                        (that.rosterVersioningSupported() && !_converse.session.get('roster_fetched'))) {
                                    _converse.send_initial_presence = true;
                                    _converse.roster.fetchFromServer().then(resolve).catch(reject);
                                } else {
                                    _converse.emit('cachedRoster', collection);
                                    resolve();
                                }
                            }
                        });
                    });
                },

                subscribeToSuggestedItems (msg) {
                    _.each(msg.querySelectorAll('item'), function (item) {
                        if (item.getAttribute('action') === 'add') {
                            _converse.roster.addAndSubscribe(
                                item.getAttribute('jid'),
                                _converse.xmppstatus.vcard.get('nickname') || _converse.xmppstatus.vcard.get('fullname')
                            );
                        }
                    });
                    return true;
                },

                isSelf (jid) {
                    return u.isSameBareJID(jid, _converse.connection.jid);
                },

                addAndSubscribe (jid, name, groups, message, attributes) {
                    /* Add a roster contact and then once we have confirmation from
                     * the XMPP server we subscribe to that contact's presence updates.
                     *  Parameters:
                     *    (String) jid - The Jabber ID of the user being added and subscribed to.
                     *    (String) name - The name of that user
                     *    (Array of Strings) groups - Any roster groups the user might belong to
                     *    (String) message - An optional message to explain the
                     *      reason for the subscription request.
                     *    (Object) attributes - Any additional attributes to be stored on the user's model.
                     */
                    const handler = (contact) => {
                        if (contact instanceof _converse.RosterContact) {
                            contact.subscribe(message);
                        }
                    }
                    this.addContactToRoster(jid, name, groups, attributes).then(handler, handler);
                },

                sendContactAddIQ (jid, name, groups, callback, errback) {
                    /*  Send an IQ stanza to the XMPP server to add a new roster contact.
                     *
                     *  Parameters:
                     *    (String) jid - The Jabber ID of the user being added
                     *    (String) name - The name of that user
                     *    (Array of Strings) groups - Any roster groups the user might belong to
                     *    (Function) callback - A function to call once the IQ is returned
                     *    (Function) errback - A function to call if an error occurred
                     */
                    name = _.isEmpty(name)? jid: name;
                    const iq = $iq({type: 'set'})
                        .c('query', {xmlns: Strophe.NS.ROSTER})
                        .c('item', { jid, name });
                    _.each(groups, function (group) { iq.c('group').t(group).up(); });
                    _converse.connection.sendIQ(iq, callback, errback);
                },

                addContactToRoster (jid, name, groups, attributes) {
                    /* Adds a RosterContact instance to _converse.roster and
                     * registers the contact on the XMPP server.
                     * Returns a promise which is resolved once the XMPP server has
                     * responded.
                     *
                     *  Parameters:
                     *    (String) jid - The Jabber ID of the user being added and subscribed to.
                     *    (String) name - The name of that user
                     *    (Array of Strings) groups - Any roster groups the user might belong to
                     *    (Object) attributes - Any additional attributes to be stored on the user's model.
                     */
                    return new Promise((resolve, reject) => {
                        groups = groups || [];
                        this.sendContactAddIQ(jid, name, groups,
                            () => {
                                const contact = this.create(_.assignIn({
                                    'ask': undefined,
                                    'nickname': name,
                                    groups,
                                    jid,
                                    'requesting': false,
                                    'subscription': 'none'
                                }, attributes), {sort: false});
                                resolve(contact);
                            },
                            function (err) {
                                alert(__('Sorry, there was an error while trying to add %1$s as a contact.', name));
                                _converse.log(err, Strophe.LogLevel.ERROR);
                                resolve(err);
                            }
                        );
                    });
                },

                subscribeBack (bare_jid, presence) {
                    const contact = this.get(bare_jid);
                    if (contact instanceof _converse.RosterContact) {
                        contact.authorize().subscribe();
                    } else {
                        // Can happen when a subscription is retried or roster was deleted
                        const handler = (contact) => {
                            if (contact instanceof _converse.RosterContact) {
                                contact.authorize().subscribe();
                            }
                        }
                        const nickname = _.get(sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, presence).pop(), 'textContent', null);
                        this.addContactToRoster(bare_jid, nickname, [], {'subscription': 'from'}).then(handler, handler);
                    }
                },

                getNumOnlineContacts () {
                    let ignored = ['offline', 'unavailable'];
                    if (_converse.show_only_online_users) {
                        ignored = _.union(ignored, ['dnd', 'xa', 'away']);
                    }
                    return _.sum(this.models.filter((model) => !_.includes(ignored, model.presence.get('show'))));
                },

                onRosterPush (iq) {
                    /* Handle roster updates from the XMPP server.
                     * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
                     *
                     * Parameters:
                     *    (XMLElement) IQ - The IQ stanza received from the XMPP server.
                     */
                    const id = iq.getAttribute('id');
                    const from = iq.getAttribute('from');
                    if (from && from !== _converse.connection.jid) {
                        // https://tools.ietf.org/html/rfc6121#page-15
                        // 
                        // A receiving client MUST ignore the stanza unless it has no 'from'
                        // attribute (i.e., implicitly from the bare JID of the user's
                        // account) or it has a 'from' attribute whose value matches the
                        // user's bare JID <user@domainpart>.
                        return;
                    }
                    _converse.connection.send($iq({type: 'result', id, from: _converse.connection.jid}));

                    const query = sizzle(`query[xmlns="${Strophe.NS.ROSTER}"]`, iq).pop();
                    this.data.save('version', query.getAttribute('ver'));

                    const items = sizzle(`item`, query);
                    if (items.length > 1) {
                        _converse.log(iq, Strophe.LogLevel.ERROR);
                        throw new Error('Roster push query may not contain more than one "item" element.');
                    }
                    if (items.length === 0) {
                        _converse.log(iq, Strophe.LogLevel.WARN);
                        _converse.log('Received a roster push stanza without an "item" element.', Strophe.LogLevel.WARN);
                        return;
                    }
                    this.updateContact(items.pop());
                    _converse.emit('rosterPush', iq);
                    return;
                },

                rosterVersioningSupported () {
                    return _converse.api.disco.stream.getFeature('ver', 'urn:xmpp:features:rosterver') && this.data.get('version');
                },

                fetchFromServer () {
                    /* Fetch the roster from the XMPP server */
                    return new Promise((resolve, reject) => {
                        const iq = $iq({
                            'type': 'get',
                            'id': _converse.connection.getUniqueId('roster')
                        }).c('query', {xmlns: Strophe.NS.ROSTER});
                        if (this.rosterVersioningSupported()) {
                            iq.attrs({'ver': this.data.get('version')});
                        }
                        const callback = _.flow(this.onReceivedFromServer.bind(this), resolve);
                        const errback = function (iq) {
                            const errmsg = "Error while trying to fetch roster from the server";
                            _converse.log(errmsg, Strophe.LogLevel.ERROR);
                            reject(new Error(errmsg));
                        }
                        return _converse.connection.sendIQ(iq, callback, errback);
                    });
                },

                onReceivedFromServer (iq) {
                    /* An IQ stanza containing the roster has been received from
                     * the XMPP server.
                     */
                    const query = sizzle(`query[xmlns="${Strophe.NS.ROSTER}"]`, iq).pop();
                    if (query) {
                        const items = sizzle(`item`, query);
                        _.each(items, (item) => this.updateContact(item));
                        this.data.save('version', query.getAttribute('ver'));
                        _converse.session.save('roster_fetched', true);
                    }
                    _converse.emit('roster', iq);
                },

                updateContact (item) {
                    /* Update or create RosterContact models based on items
                     * received in the IQ from the server.
                     */
                    const jid = item.getAttribute('jid');
                    if (this.isSelf(jid)) { return; }

                    const contact = this.get(jid),
                        subscription = item.getAttribute("subscription"),
                        ask = item.getAttribute("ask"),
                        groups = _.map(item.getElementsByTagName('group'), Strophe.getText);

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
                            'requesting': null,
                            'groups': groups
                        });
                    }
                },

                createRequestingContact (presence) {
                    const bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from')),
                        nickname = _.get(sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, presence).pop(), 'textContent', null);
                    const user_data = {
                        'jid': bare_jid,
                        'subscription': 'none',
                        'ask': null,
                        'requesting': true,
                        'nickname': nickname
                    };
                    _converse.emit('contactRequest', this.create(user_data));
                },

                handleIncomingSubscription (presence) {
                    const jid = presence.getAttribute('from'),
                        bare_jid = Strophe.getBareJidFromJid(jid),
                        contact = this.get(bare_jid);

                    if (!_converse.allow_contact_requests) {
                        _converse.rejectPresenceSubscription(
                            jid,
                            __("This client does not allow presence subscriptions")
                        );
                    }
                    if (_converse.auto_subscribe) {
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
                            (_converse.synchronize_availability === true ||
                            _converse.synchronize_availability === resource)) {
                        // Another resource has changed its status and
                        // synchronize_availability option set to update,
                        // we'll update ours as well.
                        const show = _.propertyOf(presence.querySelector('show'))('textContent') || 'online';
                        _converse.xmppstatus.save({'status': show});

                        const status_message = _.propertyOf(presence.querySelector('status'))('textContent');
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
                        _converse.xmppstatus.sendPresence();
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

                    const status_message = _.propertyOf(presence.querySelector('status'))('textContent'),
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


            _converse.RosterGroup = Backbone.Model.extend({

                initialize (attributes) {
                    this.set(_.assignIn({
                        description: __('Click to hide these contacts'),
                        state: _converse.OPENED
                    }, attributes));
                    // Collection of contacts belonging to this group.
                    this.contacts = new _converse.RosterContacts();
                }
            });


            _converse.RosterGroups = Backbone.Collection.extend({
                model: _converse.RosterGroup,

                fetchRosterGroups () {
                    /* Fetches all the roster groups from sessionStorage.
                    *
                    * Returns a promise which resolves once the groups have been
                    * returned.
                    */
                    return new Promise((resolve, reject) => {
                        this.fetch({
                            silent: true, // We need to first have all groups before
                                        // we can start positioning them, so we set
                                        // 'silent' to true.
                            success: resolve
                        });
                    });
                }
            });

            _converse.unregisterPresenceHandler = function () {
                if (!_.isUndefined(_converse.presence_ref)) {
                    _converse.connection.deleteHandler(_converse.presence_ref);
                    delete _converse.presence_ref;
                }
            };


            /********** Event Handlers *************/

            function updateUnreadCounter (chatbox) {
                const contact = _converse.roster.findWhere({'jid': chatbox.get('jid')});
                if (!_.isUndefined(contact)) {
                    contact.save({'num_unread': chatbox.get('num_unread')});
                }
            }
            _converse.api.listen.on('chatBoxesInitialized', () => {
                _converse.chatboxes.on('change:num_unread', updateUnreadCounter)
            });

            _converse.api.listen.on('beforeTearDown', _converse.unregisterPresenceHandler());

            _converse.api.listen.on('afterTearDown', () => {
                if (_converse.presences) {
                    _converse.presences.off().reset(); // Remove presences
                }
            });

            _converse.api.listen.on('clearSession', () => {
                if (_converse.presences) {
                    _converse.presences.browserStorage._clear();
                }
            });

            _converse.api.listen.on('statusInitialized', (reconnecting) => {
                if (!reconnecting) {
                    _converse.presences = new _converse.Presences();
                    _converse.presences.browserStorage = 
                        new Backbone.BrowserStorage.session(b64_sha1(`converse.presences-${_converse.bare_jid}`));
                    _converse.presences.fetch();
                }
                _converse.emit('presencesInitialized', reconnecting);
            });

            _converse.api.listen.on('presencesInitialized', (reconnecting) => {
                if (reconnecting) {
                    // No need to recreate the roster, otherwise we lose our
                    // cached data. However we still emit an event, to give
                    // event handlers a chance to register views for the
                    // roster and its groups, before we start populating.
                    _converse.emit('rosterReadyAfterReconnection');
                } else {
                    _converse.registerIntervalHandler();
                    _converse.initRoster();
                }
                _converse.roster.onConnected();
                _converse.populateRoster(reconnecting);
                _converse.registerPresenceHandler();
            });


            /************************ API ************************/
            // API methods only available to plugins

            _.extend(_converse.api, {
                'contacts': {
                    'get' (jids) {
                        const _getter = function (jid) {
                            return _converse.roster.get(Strophe.getBareJidFromJid(jid)) || null;
                        };
                        if (_.isUndefined(jids)) {
                            jids = _converse.roster.pluck('jid');
                        } else if (_.isString(jids)) {
                            return _getter(jids);
                        }
                        return _.map(jids, _getter);
                    },
                    'add' (jid, name) {
                        if (!_.isString(jid) || !_.includes(jid, '@')) {
                            throw new TypeError('contacts.add: invalid jid');
                        }
                        _converse.roster.addAndSubscribe(jid, _.isEmpty(name)? jid: name);
                    }
                }
            });
        }
    });
}));
