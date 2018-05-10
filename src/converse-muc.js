// Converse.js
// http://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define([
            "form-utils",
            "converse-core",
            "emojione",
            "converse-disco",
            "backbone.overview",
            "backbone.orderedlistview",
            "backbone.vdomview",
            "muc-utils"
    ], factory);
}(this, function (u, converse, emojione) {
    "use strict";

    const MUC_ROLE_WEIGHTS = {
        'moderator':    1,
        'participant':  2,
        'visitor':      3,
        'none':         2,
    };

    const { Strophe, Backbone, Promise, $iq, $build, $msg, $pres, b64_sha1, sizzle, _, moment } = converse.env;

    // Add Strophe Namespaces
    Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
    Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
    Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
    Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
    Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");

    converse.MUC_NICK_CHANGED_CODE = "303";
    converse.CHATROOMS_TYPE = 'chatroom';

    converse.ROOM_FEATURES = [
        'passwordprotected', 'unsecured', 'hidden',
        'publicroom', 'membersonly', 'open', 'persistent',
        'temporary', 'nonanonymous', 'semianonymous',
        'moderated', 'unmoderated', 'mam_enabled'
    ];

    converse.ROOMSTATUS = {
        CONNECTED: 0,
        CONNECTING: 1,
        NICKNAME_REQUIRED: 2,
        PASSWORD_REQUIRED: 3,
        DISCONNECTED: 4,
        ENTERED: 5
    };


    converse.plugins.add('converse-muc', {
        /* Optional dependencies are other plugins which might be
         * overridden or relied upon, and therefore need to be loaded before
         * this plugin. They are called "optional" because they might not be
         * available, in which case any overrides applicable to them will be
         * ignored.
         *
         * It's possible however to make optional dependencies non-optional.
         * If the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found.
         *
         * NB: These plugins need to have already been loaded via require.js.
         */
        dependencies: ["converse-chatboxes", "converse-disco", "converse-controlbox"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            _tearDown () {
                const rooms = this.chatboxes.where({'type': converse.CHATROOMS_TYPE});
                _.each(rooms, function (room) {
                    u.safeSave(room, {'connection_status': converse.ROOMSTATUS.DISCONNECTED});
                });
                this.__super__._tearDown.call(this, arguments);
            },

            ChatBoxes: {
                model (attrs, options) {
                    const { _converse } = this.__super__;
                    if (attrs.type == converse.CHATROOMS_TYPE) {
                        return new _converse.ChatRoom(attrs, options);
                    } else {
                        return this.__super__.model.apply(this, arguments);
                    }
                },
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                  { __ } = _converse;

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            _converse.api.settings.update({
                allow_muc: true,
                allow_muc_invitations: true,
                auto_join_on_invite: false,
                auto_join_rooms: [],
                muc_domain: undefined,
                muc_history_max_stanzas: undefined,
                muc_instant_rooms: true,
                muc_nickname_from_jid: false
            });
            _converse.api.promises.add(['roomsAutoJoined']);


            function openRoom (jid) {
                if (!u.isValidMUCJID(jid)) {
                    return _converse.log(
                        `Invalid JID "${jid}" provided in URL fragment`,
                        Strophe.LogLevel.WARN
                    );
                }
                const promises = [_converse.api.waitUntil('roomsAutoJoined')]
                if (_converse.allow_bookmarks) {
                    promises.push( _converse.api.waitUntil('bookmarksInitialized'));
                }
                Promise.all(promises).then(() => {
                    _converse.api.rooms.open(jid);
                });
            }
            _converse.router.route('converse/room?jid=:jid', openRoom);


            _converse.openChatRoom = function (jid, settings, bring_to_foreground) {
                /* Opens a chat room, making sure that certain attributes
                 * are correct, for example that the "type" is set to
                 * "chatroom".
                 */
                settings.type = converse.CHATROOMS_TYPE;
                settings.id = jid;
                settings.box_id = b64_sha1(jid)
                const chatbox = _converse.chatboxes.getChatBox(jid, settings, true);
                chatbox.trigger('show', true);
                return chatbox;
            }

            _converse.ChatRoom = _converse.ChatBox.extend({

                defaults () {
                    return _.assign(
                        _.clone(_converse.ChatBox.prototype.defaults),
                        _.zipObject(converse.ROOM_FEATURES, _.map(converse.ROOM_FEATURES, _.stubFalse)),
                        {
                          // For group chats, we distinguish between generally unread
                          // messages and those ones that specifically mention the
                          // user.
                          //
                          // To keep things simple, we reuse `num_unread` from
                          // _converse.ChatBox to indicate unread messages which
                          // mention the user and `num_unread_general` to indicate
                          // generally unread messages (which *includes* mentions!).
                          'num_unread_general': 0,

                          'affiliation': null,
                          'connection_status': converse.ROOMSTATUS.DISCONNECTED,
                          'name': '',
                          'nick': _converse.xmppstatus.get('nickname'),
                          'description': '',
                          'features_fetched': false,
                          'roomconfig': {},
                          'type': converse.CHATROOMS_TYPE,
                          'message_type': 'groupchat'
                        }
                    );
                },

                initialize() {
                    this.constructor.__super__.initialize.apply(this, arguments);
                    this.occupants = new _converse.ChatRoomOccupants();
                    this.occupants.browserStorage = new Backbone.BrowserStorage.session(
                        b64_sha1(`converse.occupants-${_converse.bare_jid}${this.get('jid')}`)
                    );
                    this.occupants.chatroom  = this;

                    this.registerHandlers();
                    this.on('change:chat_state', this.sendChatState, this);
                },

                registerHandlers () {
                    /* Register presence and message handlers for this chat
                     * room
                     */
                    const room_jid = this.get('jid');
                    this.removeHandlers();
                    this.presence_handler = _converse.connection.addHandler((stanza) => {
                            _.each(_.values(this.handlers.presence), (callback) => callback(stanza));
                            this.onPresence(stanza);
                            return true;
                        },
                        Strophe.NS.MUC, 'presence', null, null, room_jid,
                        {'ignoreNamespaceFragment': true, 'matchBareFromJid': true}
                    );
                    this.message_handler = _converse.connection.addHandler((stanza) => {
                            _.each(_.values(this.handlers.message), (callback) => callback(stanza));
                            this.onMessage(stanza);
                            return true;
                        }, null, 'message', 'groupchat', null, room_jid,
                        {'matchBareFromJid': true}
                    );
                },

                removeHandlers () {
                    /* Remove the presence and message handlers that were
                     * registered for this chat room.
                     */
                    if (this.message_handler) {
                        _converse.connection.deleteHandler(this.message_handler);
                        delete this.message_handler;
                    }
                    if (this.presence_handler) {
                        _converse.connection.deleteHandler(this.presence_handler);
                        delete this.presence_handler;
                    }
                    return this;
                },

                addHandler (type, name, callback) {
                    /* Allows 'presence' and 'message' handlers to be
                     * registered. These will be executed once presence or
                     * message stanzas are received, and *before* this model's
                     * own handlers are executed.
                     */
                    if (_.isNil(this.handlers)) {
                        this.handlers = {};
                    }
                    if (_.isNil(this.handlers[type])) {
                        this.handlers[type] = {};
                    }
                    this.handlers[type][name] = callback;
                },

                join (nick, password) {
                    /* Join the chat room.
                     *
                     * Parameters:
                     *  (String) nick: The user's nickname
                     *  (String) password: Optional password, if required by
                     *      the room.
                     */
                    nick = nick ? nick : this.get('nick');
                    if (!nick) {
                        throw new TypeError('join: You need to provide a valid nickname');
                    }
                    if (this.get('connection_status') === converse.ROOMSTATUS.ENTERED) {
                        // We have restored a chat room from session storage,
                        // so we don't send out a presence stanza again.
                        return this;
                    }
                    const stanza = $pres({
                        'from': _converse.connection.jid,
                        'to': this.getRoomJIDAndNick(nick)
                    }).c("x", {'xmlns': Strophe.NS.MUC})
                      .c("history", {'maxstanzas': _converse.muc_history_max_stanzas}).up();
                    if (password) {
                        stanza.cnode(Strophe.xmlElement("password", [], password));
                    }
                    this.save('connection_status', converse.ROOMSTATUS.CONNECTING);
                    _converse.connection.send(stanza);
                    return this;
                },

                leave (exit_msg) {
                    /* Leave the chat room.
                     *
                     * Parameters:
                     *  (String) exit_msg: Optional message to indicate your
                     *      reason for leaving.
                     */
                    this.occupants.browserStorage._clear();
                    this.occupants.reset();
                    if (_converse.connection.connected) {
                        this.sendUnavailablePresence(exit_msg);
                    }
                    u.safeSave(this, {'connection_status': converse.ROOMSTATUS.DISCONNECTED});
                    this.removeHandlers();
                },

                sendUnavailablePresence (exit_msg) {
                    const presence = $pres({
                        type: "unavailable",
                        from: _converse.connection.jid,
                        to: this.getRoomJIDAndNick()
                    });
                    if (exit_msg !== null) {
                        presence.c("status", exit_msg);
                    }
                    _converse.connection.sendPresence(presence);
                },

                getOutgoingMessageAttributes (text, spoiler_hint) {
                    const is_spoiler = this.get('composing_spoiler');
                    return {
                        'nick': this.get('nick'),
                        'from': `${this.get('jid')}/${this.get('nick')}`,
                        'fullname': this.get('nick'),
                        'is_spoiler': is_spoiler,
                        'message': text ? u.httpToGeoUri(emojione.shortnameToUnicode(text), _converse) : undefined,
                        'sender': 'me',
                        'spoiler_hint': is_spoiler ? spoiler_hint : undefined,
                        'type': 'groupchat'
                    };
                },

                getRoomFeatures () {
                    /* Fetch the room disco info, parse it and then save it.
                     */
                    return new Promise((resolve, reject) => {
                        _converse.api.disco.info(
                            this.get('jid'),
                            null,
                            _.flow(this.parseRoomFeatures.bind(this), resolve),
                            () => { reject(new Error("Could not parse the room features")) },
                            5000
                        );
                    });
                },

                getRoomJIDAndNick (nick) {
                    /* Utility method to construct the JID for the current user
                     * as occupant of the room.
                     *
                     * This is the room JID, with the user's nick added at the
                     * end.
                     *
                     * For example: room@conference.example.org/nickname
                     */
                    if (nick) {
                        this.save({'nick': nick});
                    } else {
                        nick = this.get('nick');
                    }
                    const room = this.get('jid');
                    const jid = Strophe.getBareJidFromJid(room);
                    return jid + (nick !== null ? `/${nick}` : "");
                },
                
                sendChatState () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    if (this.get('connection_status') !==  converse.ROOMSTATUS.ENTERED) {
                        return;
                    }
                    const chat_state = this.get('chat_state');
                    if (chat_state === _converse.GONE) {
                        // <gone/> is not applicable within MUC context
                        return;
                    }
                    _converse.connection.send(
                        $msg({'to':this.get('jid'), 'type': 'groupchat'})
                            .c(chat_state, {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                directInvite (recipient, reason) {
                    /* Send a direct invitation as per XEP-0249
                     *
                     * Parameters:
                     *    (String) recipient - JID of the person being invited
                     *    (String) reason - Optional reason for the invitation
                     */
                    if (this.get('membersonly')) {
                        // When inviting to a members-only room, we first add
                        // the person to the member list by giving them an
                        // affiliation of 'member' (if they're not affiliated
                        // already), otherwise they won't be able to join.
                        const map = {}; map[recipient] = 'member';
                        const deltaFunc = _.partial(u.computeAffiliationsDelta, true, false);
                        this.updateMemberLists(
                            [{'jid': recipient, 'affiliation': 'member', 'reason': reason}],
                            ['member', 'owner', 'admin'],
                            deltaFunc
                        );
                    }
                    const attrs = {
                        'xmlns': 'jabber:x:conference',
                        'jid': this.get('jid')
                    };
                    if (reason !== null) { attrs.reason = reason; }
                    if (this.get('password')) { attrs.password = this.get('password'); }
                    const invitation = $msg({
                        from: _converse.connection.jid,
                        to: recipient,
                        id: _converse.connection.getUniqueId()
                    }).c('x', attrs);
                    _converse.connection.send(invitation);
                    _converse.emit('roomInviteSent', {
                        'room': this,
                        'recipient': recipient,
                        'reason': reason
                    });
                },

                parseRoomFeatures (iq) {
                    /* Parses an IQ stanza containing the room's features.
                     *
                     * See http://xmpp.org/extensions/xep-0045.html#disco-roominfo
                     *
                     *  <identity
                     *      category='conference'
                     *      name='A Dark Cave'
                     *      type='text'/>
                     *  <feature var='http://jabber.org/protocol/muc'/>
                     *  <feature var='muc_passwordprotected'/>
                     *  <feature var='muc_hidden'/>
                     *  <feature var='muc_temporary'/>
                     *  <feature var='muc_open'/>
                     *  <feature var='muc_unmoderated'/>
                     *  <feature var='muc_nonanonymous'/>
                     *  <feature var='urn:xmpp:mam:0'/>
                     */
                    const features = {
                        'features_fetched': true,
                        'name': iq.querySelector('identity').getAttribute('name')
                    }
                    _.each(iq.querySelectorAll('feature'), function (field) {
                        const fieldname = field.getAttribute('var');
                        if (!fieldname.startsWith('muc_')) {
                            if (fieldname === Strophe.NS.MAM) {
                                features.mam_enabled = true;
                            }
                            return;
                        }
                        features[fieldname.replace('muc_', '')] = true;
                    });
                    const desc_field = iq.querySelector('field[var="muc#roominfo_description"] value');
                    if (!_.isNull(desc_field)) {
                        features.description = desc_field.textContent;
                    }
                    this.save(features);
                },

                requestMemberList (affiliation) {
                    /* Send an IQ stanza to the server, asking it for the
                     * member-list of this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (String) affiliation: The specific member list to
                     *      fetch. 'admin', 'owner' or 'member'.
                     *
                     * Returns:
                     *  A promise which resolves once the list has been
                     *  retrieved.
                     */
                    return new Promise((resolve, reject) => {
                        affiliation = affiliation || 'member';
                        const iq = $iq({to: this.get('jid'), type: "get"})
                            .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                                .c("item", {'affiliation': affiliation});
                        _converse.connection.sendIQ(iq, resolve, reject);
                    });
                },

                setAffiliation (affiliation, members) {
                    /* Send IQ stanzas to the server to set an affiliation for
                     * the provided JIDs.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * XXX: Prosody doesn't accept multiple JIDs' affiliations
                     * being set in one IQ stanza, so as a workaround we send
                     * a separate stanza for each JID.
                     * Related ticket: https://prosody.im/issues/issue/795
                     *
                     * Parameters:
                     *  (String) affiliation: The affiliation
                     *  (Object) members: A map of jids, affiliations and
                     *      optionally reasons. Only those entries with the
                     *      same affiliation as being currently set will be
                     *      considered.
                     *
                     * Returns:
                     *  A promise which resolves and fails depending on the
                     *  XMPP server response.
                     */
                    members = _.filter(members, (member) =>
                        // We only want those members who have the right
                        // affiliation (or none, which implies the provided one).
                        _.isUndefined(member.affiliation) ||
                                member.affiliation === affiliation
                    );
                    const promises = _.map(members, _.bind(this.sendAffiliationIQ, this, affiliation));
                    return Promise.all(promises);
                },

                saveConfiguration (form) {
                    /* Submit the room configuration form by sending an IQ
                     * stanza to the server.
                     *
                     * Returns a promise which resolves once the XMPP server
                     * has return a response IQ.
                     *
                     * Parameters:
                     *  (HTMLElement) form: The configuration form DOM element.
                     *      If no form is provided, the default configuration
                     *      values will be used.
                     */
                    return new Promise((resolve, reject) => {
                        const inputs = form ? sizzle(':input:not([type=button]):not([type=submit])', form) : [],
                              configArray = _.map(inputs, u.webForm2xForm);
                        this.sendConfiguration(configArray, resolve, reject);
                    });
                },

                autoConfigureChatRoom () {
                    /* Automatically configure room based on this model's
                     * 'roomconfig' data.
                     *
                     * Returns a promise which resolves once a response IQ has
                     * been received.
                     */
                    return new Promise((resolve, reject) => {
                        this.fetchRoomConfiguration().then((stanza) => {
                            const configArray = [],
                                fields = stanza.querySelectorAll('field'),
                                config = this.get('roomconfig');
                            let count = fields.length;

                            _.each(fields, (field) => {
                                const fieldname = field.getAttribute('var').replace('muc#roomconfig_', ''),
                                    type = field.getAttribute('type');
                                let value;
                                if (fieldname in config) {
                                    switch (type) {
                                        case 'boolean':
                                            value = config[fieldname] ? 1 : 0;
                                            break;
                                        case 'list-multi':
                                            // TODO: we don't yet handle "list-multi" types
                                            value = field.innerHTML;
                                            break;
                                        default:
                                            value = config[fieldname];
                                    }
                                    field.innerHTML = $build('value').t(value);
                                }
                                configArray.push(field);
                                if (!--count) {
                                    this.sendConfiguration(configArray, resolve, reject);
                                }
                            });
                        });
                    });
                },

                fetchRoomConfiguration () {
                    /* Send an IQ stanza to fetch the room configuration data.
                     * Returns a promise which resolves once the response IQ
                     * has been received.
                     */
                    return new Promise((resolve, reject) => {
                        _converse.connection.sendIQ(
                            $iq({
                                'to': this.get('jid'),
                                'type': "get"
                            }).c("query", {xmlns: Strophe.NS.MUC_OWNER}),
                            resolve,
                            reject
                        );
                    });
                },

                sendConfiguration (config, callback, errback) {
                    /* Send an IQ stanza with the room configuration.
                     *
                     * Parameters:
                     *  (Array) config: The room configuration
                     *  (Function) callback: Callback upon succesful IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     *  (Function) errback: Callback upon error IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     */
                    const iq = $iq({to: this.get('jid'), type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                        .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                    _.each(config || [], function (node) { iq.cnode(node).up(); });
                    callback = _.isUndefined(callback) ? _.noop : _.partial(callback, iq.nodeTree);
                    errback = _.isUndefined(errback) ? _.noop : _.partial(errback, iq.nodeTree);
                    return _converse.connection.sendIQ(iq, callback, errback);
                },

                saveAffiliationAndRole (pres) {
                    /* Parse the presence stanza for the current user's
                     * affiliation.
                     *
                     * Parameters:
                     *  (XMLElement) pres: A <presence> stanza.
                     */
                    const item = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"] item`, pres).pop();
                    const is_self = pres.querySelector("status[code='110']");
                    if (is_self && !_.isNil(item)) {
                        const affiliation = item.getAttribute('affiliation');
                        const role = item.getAttribute('role');
                        if (affiliation) {
                            this.save({'affiliation': affiliation});
                        }
                        if (role) {
                            this.save({'role': role});
                        }
                    }
                },

                sendAffiliationIQ (affiliation, member) {
                    /* Send an IQ stanza specifying an affiliation change.
                     *
                     * Paremeters:
                     *  (String) affiliation: affiliation (could also be stored
                     *      on the member object).
                     *  (Object) member: Map containing the member's jid and
                     *      optionally a reason and affiliation.
                     */
                    return new Promise((resolve, reject) => {
                        const iq = $iq({to: this.get('jid'), type: "set"})
                            .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                            .c("item", {
                                'affiliation': member.affiliation || affiliation,
                                'jid': member.jid
                            });
                        if (!_.isUndefined(member.reason)) {
                            iq.c("reason", member.reason);
                        }
                        _converse.connection.sendIQ(iq, resolve, reject);
                    });
                },

                setAffiliations (members) {
                    /* Send IQ stanzas to the server to modify the
                     * affiliations in this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (Object) members: A map of jids, affiliations and optionally reasons
                     *  (Function) onSuccess: callback for a succesful response
                     *  (Function) onError: callback for an error response
                     */
                    const affiliations = _.uniq(_.map(members, 'affiliation'));
                    _.each(affiliations, _.partial(this.setAffiliation.bind(this), _, members));
                },

                getJidsWithAffiliations (affiliations) {
                    /* Returns a map of JIDs that have the affiliations
                     * as provided.
                     */
                    if (_.isString(affiliations)) {
                        affiliations = [affiliations];
                    }
                    return new Promise((resolve, reject) => {
                        const promises = _.map(
                            affiliations,
                            _.partial(this.requestMemberList.bind(this))
                        );
                        Promise.all(promises).then(
                            _.flow(u.marshallAffiliationIQs, resolve),
                            _.flow(u.marshallAffiliationIQs, resolve)
                        );
                    });
                },

                updateMemberLists (members, affiliations, deltaFunc) {
                    /* Fetch the lists of users with the given affiliations.
                     * Then compute the delta between those users and
                     * the passed in members, and if it exists, send the delta
                     * to the XMPP server to update the member list.
                     *
                     * Parameters:
                     *  (Object) members: Map of member jids and affiliations.
                     *  (String|Array) affiliation: An array of affiliations or
                     *      a string if only one affiliation.
                     *  (Function) deltaFunc: The function to compute the delta
                     *      between old and new member lists.
                     *
                     * Returns:
                     *  A promise which is resolved once the list has been
                     *  updated or once it's been established there's no need
                     *  to update the list.
                     */
                    this.getJidsWithAffiliations(affiliations).then((old_members) => {
                        this.setAffiliations(deltaFunc(members, old_members));
                    });
                },

                checkForReservedNick (callback, errback) {
                    /* Use service-discovery to ask the XMPP server whether
                     * this user has a reserved nickname for this room.
                     * If so, we'll use that, otherwise we render the nickname form.
                     *
                     * Parameters:
                     *  (Function) callback: Callback upon succesful IQ response
                     *  (Function) errback: Callback upon error IQ response
                     */
                    _converse.connection.sendIQ(
                        $iq({
                            'to': this.get('jid'),
                            'from': _converse.connection.jid,
                            'type': "get"
                        }).c("query", {
                            'xmlns': Strophe.NS.DISCO_INFO,
                            'node': 'x-roomuser-item'
                        }),
                        callback, errback);
                    return this;
                },

                updateOccupantsOnPresence (pres) {
                    /* Given a presence stanza, update the occupant model
                     * based on its contents.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The presence stanza
                     */
                    const data = this.parsePresence(pres);
                    if (data.type === 'error') {
                        return true;
                    }
                    const occupant = this.occupants.findOccupant(data);
                    if (data.type === 'unavailable') {
                        if (occupant) {
                            // Even before destroying, we set the new data, so
                            // that we can for example show the
                            // disconnection message.
                            occupant.set(data);
                        }
                        if (!_.includes(data.states, converse.MUC_NICK_CHANGED_CODE)) {
                            // We only destroy the occupant if this is not a
                            // nickname change operation.
                            if (occupant) {
                                occupant.destroy();
                            }
                            return;
                        }
                    }
                    const jid = Strophe.getBareJidFromJid(data.jid);
                    const attributes = _.extend(data, {
                        'jid': jid ? jid : undefined,
                        'resource': data.jid ? Strophe.getResourceFromJid(data.jid) : undefined
                    });
                    if (occupant) {
                        occupant.save(attributes);
                    } else {
                        this.occupants.create(attributes);
                    }
                },

                parsePresence (pres) {
                    const from = pres.getAttribute("from"),
                          data = {
                            'from': from,
                            'nick': Strophe.getResourceFromJid(from),
                            'type': pres.getAttribute("type"),
                            'states': [],
                            'show': 'online'
                          };
                    _.each(pres.childNodes, function (child) {
                        switch (child.nodeName) {
                            case "status":
                                data.status = child.textContent || null;
                                break;
                            case "show":
                                data.show = child.textContent || 'online';
                                break;
                            case "x":
                                if (child.getAttribute("xmlns") === Strophe.NS.MUC_USER) {
                                    _.each(child.childNodes, function (item) {
                                        switch (item.nodeName) {
                                            case "item":
                                                data.affiliation = item.getAttribute("affiliation");
                                                data.role = item.getAttribute("role");
                                                data.jid = item.getAttribute("jid");
                                                data.nick = item.getAttribute("nick") || data.nick;
                                                break;
                                            case "status":
                                                if (item.getAttribute("code")) {
                                                    data.states.push(item.getAttribute("code"));
                                                }
                                        }
                                    });
                                } else if (child.getAttribute("xmlns") === Strophe.NS.VCARDUPDATE) {
                                    data.image_hash = _.get(child.querySelector('photo'), 'textContent');
                                }
                        }
                    });
                    return data;
                },

                isDuplicate (message, original_stanza) {
                    const msgid = message.getAttribute('id'),
                          jid = message.getAttribute('from');
                    if (msgid) {
                        return this.messages.where({'msgid': msgid, 'from': jid}).length;
                    }
                    return false;
                },

                fetchFeaturesIfConfigurationChanged (stanza) {
                    const configuration_changed = stanza.querySelector("status[code='104']"),
                          logging_enabled = stanza.querySelector("status[code='170']"),
                          logging_disabled = stanza.querySelector("status[code='171']"),
                          room_no_longer_anon = stanza.querySelector("status[code='172']"),
                          room_now_semi_anon = stanza.querySelector("status[code='173']"),
                          room_now_fully_anon = stanza.querySelector("status[code='173']");

                    if (configuration_changed || logging_enabled || logging_disabled ||
                            room_no_longer_anon || room_now_semi_anon || room_now_fully_anon) {
                        this.getRoomFeatures();
                    }
                },

                onMessage (stanza) {
                    /* Handler for all MUC messages sent to this chat room.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message stanza.
                     */
                    this.fetchFeaturesIfConfigurationChanged(stanza);

                    const original_stanza = stanza,
                          forwarded = stanza.querySelector('forwarded');
                    let delay;
                    if (!_.isNull(forwarded)) {
                        stanza = forwarded.querySelector('message');
                        delay = forwarded.querySelector('delay');
                    }
                    const jid = stanza.getAttribute('from'),
                        resource = Strophe.getResourceFromJid(jid),
                        sender = resource && Strophe.unescapeNode(resource) || '',
                        subject = _.propertyOf(stanza.querySelector('subject'))('textContent');

                    if (this.isDuplicate(stanza, original_stanza)) {
                        return;
                    }
                    if (subject) {
                        u.safeSave(this, {'subject': {'author': sender, 'text': subject}});
                    }
                    if (sender === '') {
                        return;
                    }
                    this.incrementUnreadMsgCounter(original_stanza);
                    this.createMessage(stanza, delay, original_stanza);
                    if (sender !== this.get('nick')) {
                        // We only emit an event if it's not our own message
                        _converse.emit('message', {'stanza': original_stanza, 'chatbox': this});
                    }
                },

                onPresence (pres) {
                    /* Handles all MUC presence stanzas.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The stanza
                     */
                    if (pres.getAttribute('type') === 'error') {
                        this.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                        return;
                    }
                    const is_self = pres.querySelector("status[code='110']");
                    if (is_self && pres.getAttribute('type') !== 'unavailable') {
                        this.onOwnPresence(pres);
                    }
                    this.updateOccupantsOnPresence(pres);
                    if (this.get('role') !== 'none' && this.get('connection_status') === converse.ROOMSTATUS.CONNECTING) {
                        this.save('connection_status', converse.ROOMSTATUS.CONNECTED);
                    }
                },
 
                onOwnPresence (pres) {
                    /* Handles a received presence relating to the current
                     * user.
                     *
                     * For locked rooms (which are by definition "new"), the
                     * room will either be auto-configured or created instantly
                     * (with default config) or a configuration room will be
                     * rendered.
                     *
                     * If the room is not locked, then the room will be
                     * auto-configured only if applicable and if the current
                     * user is the room's owner.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The stanza
                     */
                    this.saveAffiliationAndRole(pres);

                    const locked_room = pres.querySelector("status[code='201']");
                    if (locked_room) {
                        if (this.get('auto_configure')) {
                            this.autoConfigureChatRoom().then(this.getRoomFeatures.bind(this));
                        } else if (_converse.muc_instant_rooms) {
                            // Accept default configuration
                            this.saveConfiguration().then(this.getRoomFeatures.bind(this));
                        } else {
                            this.trigger('configurationNeeded');
                            return; // We haven't yet entered the room, so bail here.
                        }
                    } else if (!this.get('features_fetched')) {
                        // The features for this room weren't fetched.
                        // That must mean it's a new room without locking
                        // (in which case Prosody doesn't send a 201 status),
                        // otherwise the features would have been fetched in
                        // the "initialize" method already.
                        if (this.get('affiliation') === 'owner' && this.get('auto_configure')) {
                            this.autoConfigureChatRoom().then(this.getRoomFeatures.bind(this));
                        } else {
                            this.getRoomFeatures();
                        }
                    }
                    this.save('connection_status', converse.ROOMSTATUS.ENTERED);
                },

                isUserMentioned (message) {
                    /* Returns a boolean to indicate whether the current user
                     * was mentioned in a message.
                     *
                     * Parameters:
                     *  (String): The text message
                     */
                    return (new RegExp(`\\b${this.get('nick')}\\b`)).test(message);
                },

                incrementUnreadMsgCounter (stanza) {
                    /* Given a newly received message, update the unread counter if
                     * necessary.
                     *
                     * Parameters:
                     *  (XMLElement): The <messsage> stanza
                     */
                    const body = stanza.querySelector('body');
                    if (_.isNull(body)) {
                        return; // The message has no text
                    }
                    if (u.isNewMessage(stanza) && this.newMessageWillBeHidden()) {
                        const settings = {'num_unread_general': this.get('num_unread_general') + 1};
                        if (this.isUserMentioned(body.textContent)) {
                            settings.num_unread = this.get('num_unread') + 1;
                            _converse.incrementMsgCounter();
                        }
                        this.save(settings);
                    }
                },

                clearUnreadMsgCounter() {
                    u.safeSave(this, {
                        'num_unread': 0,
                        'num_unread_general': 0
                    });
                }
            });


            _converse.ChatRoomOccupant = Backbone.Model.extend({

                defaults: {
                    'show': 'offline'
                },

                initialize (attributes) {
                    this.set(_.extend({
                        'id': _converse.connection.getUniqueId(),
                    }, attributes));

                    this.on('change:image_hash', this.onAvatarChanged, this);
                },

                onAvatarChanged () {
                    const vcard = _converse.vcards.findWhere({'jid': this.get('from')});
                    if (!vcard) { return; }

                    const hash = this.get('image_hash');
                    if (hash && vcard.get('image_hash') !== hash) {
                        _converse.api.vcard.update(vcard);
                    }
                }
            });


            _converse.ChatRoomOccupants = Backbone.Collection.extend({
                model: _converse.ChatRoomOccupant,

                comparator (occupant1, occupant2) {
                    const role1 = occupant1.get('role') || 'none';
                    const role2 = occupant2.get('role') || 'none';
                    if (MUC_ROLE_WEIGHTS[role1] === MUC_ROLE_WEIGHTS[role2]) {
                        const nick1 = occupant1.get('nick').toLowerCase();
                        const nick2 = occupant2.get('nick').toLowerCase();
                        return nick1 < nick2 ? -1 : (nick1 > nick2? 1 : 0);
                    } else  {
                        return MUC_ROLE_WEIGHTS[role1] < MUC_ROLE_WEIGHTS[role2] ? -1 : 1;
                    }
                },

                fetchMembers () {
                    this.chatroom.getJidsWithAffiliations(['member', 'owner', 'admin'])
                    .then((jids) => {
                        _.each(jids, (attrs) => {
                            const occupant = this.findOccupant({'jid': attrs.jid});
                            if (occupant) {
                                occupant.save(attrs);
                            } else {
                                this.create(attrs);
                            }
                        });
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                },

                findOccupant (data) {
                    /* Try to find an existing occupant based on the passed in
                     * data object.
                     *
                     * If we have a JID, we use that as lookup variable,
                     * otherwise we use the nick. We don't always have both,
                     * but should have at least one or the other.
                     */
                    const jid = Strophe.getBareJidFromJid(data.jid);
                    if (jid !== null) {
                        return this.where({'jid': jid}).pop();
                    } else {
                        return this.where({'nick': data.nick}).pop();
                    }
                }
            });


            _converse.RoomsPanelModel = Backbone.Model.extend({
                defaults: {
                    'muc_domain': '',
                },
            });


            _converse.onDirectMUCInvitation = function (message) {
                /* A direct MUC invitation to join a room has been received
                 * See XEP-0249: Direct MUC invitations.
                 *
                 * Parameters:
                 *  (XMLElement) message: The message stanza containing the
                 *        invitation.
                 */
                const x_el = sizzle('x[xmlns="jabber:x:conference"]', message).pop(),
                    from = Strophe.getBareJidFromJid(message.getAttribute('from')),
                    room_jid = x_el.getAttribute('jid'),
                    reason = x_el.getAttribute('reason');

                let contact = _converse.roster.get(from),
                    result;

                if (_converse.auto_join_on_invite) {
                    result = true;
                } else {
                    // Invite request might come from someone not your roster list
                    contact = contact? contact.get('fullname'): Strophe.getNodeFromJid(from);
                    if (!reason) {
                        result = confirm(
                            __("%1$s has invited you to join a chat room: %2$s", contact, room_jid)
                        );
                    } else {
                        result = confirm(
                            __('%1$s has invited you to join a chat room: %2$s, and left the following reason: "%3$s"',
                                contact, room_jid, reason)
                        );
                    }
                }
                if (result === true) {
                    const chatroom = _converse.openChatRoom(
                        room_jid, {'password': x_el.getAttribute('password') });

                    if (chatroom.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED) {
                        _converse.chatboxviews.get(room_jid).join();
                    }
                }
            };

            if (_converse.allow_muc_invitations) {
                const registerDirectInvitationHandler = function () {
                    _converse.connection.addHandler(
                        function (message) {
                            _converse.onDirectMUCInvitation(message);
                            return true;
                        }, 'jabber:x:conference', 'message');
                };
                _converse.on('connected', registerDirectInvitationHandler);
                _converse.on('reconnected', registerDirectInvitationHandler);
            }

            const getChatRoom = function (jid, attrs, create) {
                jid = jid.toLowerCase();
                attrs.type = converse.CHATROOMS_TYPE;
                attrs.id = jid;
                attrs.box_id = b64_sha1(jid)
                return _converse.chatboxes.getChatBox(jid, attrs, create);
            };

            const createChatRoom = function (jid, attrs) {
                return getChatRoom(jid, attrs, true);
            };

            function autoJoinRooms () {
                /* Automatically join chat rooms, based on the
                 * "auto_join_rooms" configuration setting, which is an array
                 * of strings (room JIDs) or objects (with room JID and other
                 * settings).
                 */
                _.each(_converse.auto_join_rooms, function (room) {
                    if (_converse.chatboxes.where({'jid': room}).length) {
                        return;
                    }
                    if (_.isString(room)) {
                        _converse.api.rooms.open(room);
                    } else if (_.isObject(room)) {
                        _converse.api.rooms.open(room.jid, room.nick);
                    } else {
                        _converse.log(
                            'Invalid room criteria specified for "auto_join_rooms"',
                            Strophe.LogLevel.ERROR);
                    }
                });
                _converse.emit('roomsAutoJoined');
            }

            function disconnectChatRooms () {
                /* When disconnecting, or reconnecting, mark all chat rooms as
                 * disconnected, so that they will be properly entered again
                 * when fetched from session storage.
                 */
                _converse.chatboxes.each(function (model) {
                    if (model.get('type') === converse.CHATROOMS_TYPE) {
                        model.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                    }
                });
            }

            /************************ BEGIN Event Handlers ************************/
            _converse.on('addClientFeatures', () => {
                if (_converse.allow_muc) {
                    _converse.api.disco.addFeature(Strophe.NS.MUC);
                }
                if (_converse.allow_muc_invitations) {
                    _converse.api.disco.addFeature('jabber:x:conference'); // Invites
                }
            });
            _converse.on('chatBoxesFetched', autoJoinRooms);
            _converse.on('reconnecting', disconnectChatRooms);
            _converse.on('disconnecting', disconnectChatRooms);
            /************************ END Event Handlers ************************/


            /************************ BEGIN API ************************/
            // We extend the default converse.js API to add methods specific to MUC chat rooms.
            _.extend(_converse.api, {
                'rooms': {
                    'close' (jids) {
                        if (_.isUndefined(jids)) {
                            // FIXME: can't access views here
                            _converse.chatboxviews.each(function (view) {
                                if (view.is_chatroom && view.model) {
                                    view.close();
                                }
                            });
                        } else if (_.isString(jids)) {
                            const view = _converse.chatboxviews.get(jids);
                            if (view) { view.close(); }
                        } else {
                            _.each(jids, function (jid) {
                                const view = _converse.chatboxviews.get(jid);
                                if (view) { view.close(); }
                            });
                        }
                    },
                    'create' (jids, attrs) {
                        if (_.isString(attrs)) {
                            attrs = {'nick': attrs};
                        } else if (_.isUndefined(attrs)) {
                            attrs = {};
                        }
                        if (_.isUndefined(attrs.maximize)) {
                            attrs.maximize = false;
                        }
                        if (!attrs.nick && _converse.muc_nickname_from_jid) {
                            attrs.nick = Strophe.getNodeFromJid(_converse.bare_jid);
                        }
                        if (_.isUndefined(jids)) {
                            throw new TypeError('rooms.create: You need to provide at least one JID');
                        } else if (_.isString(jids)) {
                            return createChatRoom(jids, attrs);
                        }
                        return _.map(jids, _.partial(createChatRoom, _, attrs));
                    },
                    'open' (jids, attrs) {
                        if (_.isUndefined(jids)) {
                            throw new TypeError('rooms.open: You need to provide at least one JID');
                        } else if (_.isString(jids)) {
                            return _converse.api.rooms.create(jids, attrs).trigger('show');
                        }
                        return _.map(jids, (jid) => _converse.api.rooms.create(jid, attrs).trigger('show'));
                    },
                    'get' (jids, attrs, create) {
                        if (_.isString(attrs)) {
                            attrs = {'nick': attrs};
                        } else if (_.isUndefined(attrs)) {
                            attrs = {};
                        }
                        if (_.isUndefined(jids)) {
                            const result = [];
                            _converse.chatboxes.each(function (chatbox) {
                                if (chatbox.get('type') === converse.CHATROOMS_TYPE) {
                                    result.push(chatbox);
                                }
                            });
                            return result;
                        }
                        if (!attrs.nick) {
                            attrs.nick = Strophe.getNodeFromJid(_converse.bare_jid);
                        }
                        if (_.isString(jids)) {
                            return getChatRoom(jids, attrs);
                        }
                        return _.map(jids, _.partial(getChatRoom, _, attrs));
                    }
                }
            });
            /************************ END API ************************/
        }
    });
}));
