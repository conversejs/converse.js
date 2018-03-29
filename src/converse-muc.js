// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define([
            "form-utils",
            "converse-core",
            "converse-chatview",
            "converse-disco",
            "backbone.overview",
            "backbone.orderedlistview",
            "backbone.vdomview",
            "muc-utils"
    ], factory);
}(this, function (u, converse) {
    "use strict";

    const MUC_ROLE_WEIGHTS = {
        'moderator':    1,
        'participant':  2,
        'visitor':      3,
        'none':         4,
    };

    const { Strophe, Backbone, Promise, $iq, $build, $msg, $pres, b64_sha1, sizzle, _, moment } = converse.env;

    // Add Strophe Namespaces
    Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
    Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
    Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
    Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
    Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");

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
        dependencies: ["converse-controlbox", "converse-chatview"],

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

            function ___ (str) {
                /* This is part of a hack to get gettext to scan strings to be
                * translated. Strings we cannot send to the function above because
                * they require variable interpolation and we don't yet have the
                * variables at scan time.
                *
                * See actionInfoMessages further below.
                */
                return str;
            }

            // XXX: Inside plugins, all calls to the translation machinery
            // (e.g. u.__) should only be done in the initialize function.
            // If called before, we won't know what language the user wants,
            // and it'll fall back to English.

            /* http://xmpp.org/extensions/xep-0045.html
             * ----------------------------------------
             * 100 message      Entering a room         Inform user that any occupant is allowed to see the user's full JID
             * 101 message (out of band)                Affiliation change  Inform user that his or her affiliation changed while not in the room
             * 102 message      Configuration change    Inform occupants that room now shows unavailable members
             * 103 message      Configuration change    Inform occupants that room now does not show unavailable members
             * 104 message      Configuration change    Inform occupants that a non-privacy-related room configuration change has occurred
             * 110 presence     Any room presence       Inform user that presence refers to one of its own room occupants
             * 170 message or initial presence          Configuration change    Inform occupants that room logging is now enabled
             * 171 message      Configuration change    Inform occupants that room logging is now disabled
             * 172 message      Configuration change    Inform occupants that the room is now non-anonymous
             * 173 message      Configuration change    Inform occupants that the room is now semi-anonymous
             * 174 message      Configuration change    Inform occupants that the room is now fully-anonymous
             * 201 presence     Entering a room         Inform user that a new room has been created
             * 210 presence     Entering a room         Inform user that the service has assigned or modified the occupant's roomnick
             * 301 presence     Removal from room       Inform user that he or she has been banned from the room
             * 303 presence     Exiting a room          Inform all occupants of new room nickname
             * 307 presence     Removal from room       Inform user that he or she has been kicked from the room
             * 321 presence     Removal from room       Inform user that he or she is being removed from the room because of an affiliation change
             * 322 presence     Removal from room       Inform user that he or she is being removed from the room because the room has been changed to members-only and the user is not a member
             * 332 presence     Removal from room       Inform user that he or she is being removed from the room because of a system shutdown
             */
            _converse.muc = {
                info_messages: {
                    100: __('This room is not anonymous'),
                    102: __('This room now shows unavailable members'),
                    103: __('This room does not show unavailable members'),
                    104: __('The room configuration has changed'),
                    170: __('Room logging is now enabled'),
                    171: __('Room logging is now disabled'),
                    172: __('This room is now no longer anonymous'),
                    173: __('This room is now semi-anonymous'),
                    174: __('This room is now fully-anonymous'),
                    201: __('A new room has been created')
                },

                disconnect_messages: {
                    301: __('You have been banned from this room'),
                    307: __('You have been kicked from this room'),
                    321: __("You have been removed from this room because of an affiliation change"),
                    322: __("You have been removed from this room because the room has changed to members-only and you're not a member"),
                    332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down")
                },

                action_info_messages: {
                    /* XXX: Note the triple underscore function and not double
                    * underscore.
                    *
                    * This is a hack. We can't pass the strings to __ because we
                    * don't yet know what the variable to interpolate is.
                    *
                    * Triple underscore will just return the string again, but we
                    * can then at least tell gettext to scan for it so that these
                    * strings are picked up by the translation machinery.
                    */
                    301: ___("%1$s has been banned"),
                    303: ___("%1$s's nickname has changed"),
                    307: ___("%1$s has been kicked out"),
                    321: ___("%1$s has been removed because of an affiliation change"),
                    322: ___("%1$s has been removed for not being a member")
                },

                new_nickname_messages: {
                    210: ___('Your nickname has been automatically set to %1$s'),
                    303: ___('Your nickname has been changed to %1$s')
                }
            };

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            _converse.api.settings.update({
                allow_muc: true,
                allow_muc_invitations: true,
                auto_join_on_invite: false,
                auto_join_rooms: [],
                auto_list_rooms: false,
                hide_muc_server: false,
                muc_disable_moderator_commands: false,
                muc_domain: undefined,
                muc_history_max_stanzas: undefined,
                muc_instant_rooms: true,
                muc_nickname_from_jid: false,
                muc_show_join_leave: true,
                visible_toolbar_buttons: {
                    'toggle_occupants': true
                },
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
                        }
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
                initialize (attributes) {
                    this.set(_.extend({
                        'id': _converse.connection.getUniqueId(),
                    }, attributes));
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


            function reconnectToChatRooms () {
                /* Upon a reconnection event from converse, join again
                 * all the open chat rooms.
                 */
                _converse.chatboxviews.each(function (view) {
                    if (view.model.get('type') === converse.CHATROOMS_TYPE) {
                        view.model.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                        view.registerHandlers();
                        view.join();
                        view.fetchMessages();
                    }
                });
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
                    _converse.connection.disco.addFeature(Strophe.NS.MUC);
                }
                if (_converse.allow_muc_invitations) {
                    _converse.connection.disco.addFeature('jabber:x:conference'); // Invites
                }
            });
            _converse.on('chatBoxesFetched', autoJoinRooms);
            _converse.on('reconnected', reconnectToChatRooms);
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
