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
            "emojione",
            "lodash.fp",
            "converse-disco",
            "backbone.overview"
    ], factory);
}(this, function (u, converse, emojione, f) {
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


            _converse.openChatRoom = function (settings, bring_to_foreground) {
                /* Opens a chat room, making sure that certain attributes
                 * are correct, for example that the "type" is set to
                 * "chatroom".
                 */
                if (_.isUndefined(settings.jid)) {
                    throw new Error("openChatRoom needs to be called with a JID");
                }
                settings.type = converse.CHATROOMS_TYPE;
                settings.id = settings.jid;
                settings.box_id = b64_sha1(settings.jid)
                return _converse.chatboxviews.showChat(settings, bring_to_foreground);
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
                          'description': '',
                          'features_fetched': false,
                          'roomconfig': {},
                          'type': converse.CHATROOMS_TYPE,
                        }
                    );
                },

                initialize() {
                  this.constructor.__super__.initialize.apply(this, arguments);
                  this.occupants = new _converse.ChatRoomOccupants();
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
                        return null;
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

                getRoomFeatures () {
                    /* Fetch the room disco info, parse it and then
                     * save it on the Backbone.Model of this chat rooms.
                     */
                    return new Promise((resolve, reject) => {
                        _converse.connection.disco.info(
                            this.get('jid'),
                            null,
                            _.flow(this.parseRoomFeatures.bind(this), resolve),
                            () => { reject(new Error("Could not parse the room features")) },
                            5000
                        );
                    });
                },

                parseRoomFeatures (iq) {
                    /* See http://xmpp.org/extensions/xep-0045.html#disco-roominfo
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

                fetchRoomConfiguration (handler) {
                    /* Send an IQ stanza to fetch the room configuration data.
                     * Returns a promise which resolves once the response IQ
                     * has been received.
                     *
                     * Parameters:
                     *  (Function) handler: The handler for the response IQ
                     */
                    return new Promise((resolve, reject) => {
                        _converse.connection.sendIQ(
                            $iq({
                                'to': this.get('jid'),
                                'type': "get"
                            }).c("query", {xmlns: Strophe.NS.MUC_OWNER}),
                            (iq) => {
                                if (handler) {
                                    handler.apply(this, arguments);
                                }
                                resolve(iq);
                            },
                            reject // errback
                        );
                    });
                },

                sendConfiguration(config, onSuccess, onError) {
                    /* Send an IQ stanza with the room configuration.
                     *
                     * Parameters:
                     *  (Array) config: The room configuration
                     *  (Function) onSuccess: Callback upon succesful IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     *  (Function) onError: Callback upon error IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     */
                    const iq = $iq({to: this.get('jid'), type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                        .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                    _.each(config || [], function (node) { iq.cnode(node).up(); });
                    onSuccess = _.isUndefined(onSuccess) ? _.noop : _.partial(onSuccess, iq.nodeTree);
                    onError = _.isUndefined(onError) ? _.noop : _.partial(onError, iq.nodeTree);
                    return _converse.connection.sendIQ(iq, onSuccess, onError);
                },

                autoConfigureChatRoom () {
                    /* Automatically configure room based on the
                     * 'roomconfig' data on this view's model.
                     *
                     * Returns a promise which resolves once a response IQ has
                     * been received.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: IQ stanza from the server,
                     *       containing the configuration.
                     */
                    const that = this;
                    return new Promise((resolve, reject) => {
                        this.fetchRoomConfiguration().then(function (stanza) {
                            const configArray = [],
                                fields = stanza.querySelectorAll('field'),
                                config = that.get('roomconfig');
                            let count = fields.length;

                            _.each(fields, function (field) {
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
                                    that.sendConfiguration(configArray, resolve, reject);
                                }
                            });
                        });
                    });
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
                     */
                    return new Promise((resolve, reject) => {
                        const inputs = form ? sizzle(':input:not([type=button]):not([type=submit])', form) : [],
                              configArray = _.map(inputs, u.webForm2xForm);
                        this.model.sendConfiguration(configArray, resolve, reject);
                    });
                },

                onOwnChatRoomPresence (pres) {
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

                onChatRoomPresence (pres) {
                    /* Handles all MUC presence stanzas.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The stanza
                     */
                    if (pres.getAttribute('type') === 'error') {
                        this.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                        return true;
                    }
                    const is_self = pres.querySelector("status[code='110']");
                    if (is_self && pres.getAttribute('type') !== 'unavailable') {
                        this.onOwnChatRoomPresence(pres);
                    }
                    // This must be called after showStatusMessages so that
                    // "join" messages are correctly shown.
                    this.occupants.updateOccupantsOnPresence(pres);
                    if (this.get('role') !== 'none' &&
                            this.get('connection_status') === converse.ROOMSTATUS.CONNECTING) {
                        this.save('connection_status', converse.ROOMSTATUS.CONNECTED);
                    }
                    return true;
                },

                isDuplicateBasedOnTime (message) {
                    /* Checks whether a received messages is actually a
                     * duplicate based on whether it has a "ts" attribute
                     * with a unix timestamp.
                     *
                     * This is used for better integration with Slack's XMPP
                     * gateway, which doesn't use message IDs but instead the
                     * aforementioned "ts" attributes.
                     */
                    const entity = _converse.disco_entities.get(_converse.domain);
                    if (entity.identities.where({'name': "Slack-XMPP"})) {
                        const ts = message.getAttribute('ts');
                        if (_.isNull(ts)) {
                            return false;
                        } else {
                            return this.messages.where({
                                'sender': 'me',
                                'message': this.getMessageBody(message)
                            }).filter(
                                (msg) => Math.abs(moment(msg.get('time')).diff(moment.unix(ts))) < 5000
                            ).length > 0;
                        }
                    }
                    return false;
                },

                isDuplicate (message, original_stanza) {
                    const msgid = message.getAttribute('id'),
                          jid = message.getAttribute('from'),
                          resource = Strophe.getResourceFromJid(jid),
                          sender = resource && Strophe.unescapeNode(resource) || '';
                    if (msgid) {
                        return this.messages.filter(
                            // Some bots (like HAL in the prosody chatroom)
                            // respond to commands with the same ID as the
                            // original message. So we also check the sender.
                            (msg) => msg.get('msgid') === msgid && msg.get('fullname') === sender
                        ).length > 0;
                    }
                    return this.isDuplicateBasedOnTime(message);
                },

                onChatRoomMessage (message) {
                    /* Given a <message> stanza, create a message
                     * Backbone.Model if appropriate.
                     *
                     * Parameters:
                     *  (XMLElement) msg: The received message stanza
                     */
                    const original_stanza = message,
                        forwarded = message.querySelector('forwarded');
                    let delay;
                    if (!_.isNull(forwarded)) {
                        message = forwarded.querySelector('message');
                        delay = forwarded.querySelector('delay');
                    }
                    const jid = message.getAttribute('from'),
                        resource = Strophe.getResourceFromJid(jid),
                        sender = resource && Strophe.unescapeNode(resource) || '',
                        subject = _.propertyOf(message.querySelector('subject'))('textContent');

                    if (this.isDuplicate(message, original_stanza)) {
                        return true;
                    }
                    if (subject) {
                        this.setChatRoomSubject(sender, subject);
                    }
                    if (sender === '') {
                        return true;
                    }
                    this.incrementUnreadMsgCounter(original_stanza);
                    this.createMessage(message, delay, original_stanza);
                    if (sender !== this.get('nick')) {
                        // We only emit an event if it's not our own message
                        _converse.emit(
                            'message',
                            {'stanza': original_stanza, 'chatbox': this}
                        );
                    }
                    return true;
                },

                handleMUCMessage (stanza) {
                    /* Handler for all MUC messages sent to this chat room.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message stanza.
                     */
                    const configuration_changed = stanza.querySelector("status[code='104']");
                    const logging_enabled = stanza.querySelector("status[code='170']");
                    const logging_disabled = stanza.querySelector("status[code='171']");
                    const room_no_longer_anon = stanza.querySelector("status[code='172']");
                    const room_now_semi_anon = stanza.querySelector("status[code='173']");
                    const room_now_fully_anon = stanza.querySelector("status[code='173']");
                    if (configuration_changed || logging_enabled || logging_disabled ||
                            room_no_longer_anon || room_now_semi_anon || room_now_fully_anon) {
                        this.getRoomFeatures();
                    }
                    this.onChatRoomMessage(stanza);
                    return true;
                },

                sendChatRoomMessage (text) {
                    /* Constuct a message stanza to be sent to this chat room,
                     * and send it to the server.
                     *
                     * Parameters:
                     *  (String) text: The message text to be sent.
                     */
                    text = emojione.shortnameToUnicode(text)
                    const msgid = _converse.connection.getUniqueId();
                    const msg = $msg({
                        to: this.get('jid'),
                        from: _converse.connection.jid,
                        type: 'groupchat',
                        id: msgid
                    }).c("body").t(text).up()
                    .c("x", {xmlns: "jabber:x:event"}).c(_converse.COMPOSING);
                    _converse.connection.send(msg);
                    this.messages.create({
                        fullname: this.get('nick'),
                        sender: 'me',
                        time: moment().format(),
                        message: text,
                        msgid
                    });
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
                        this.save({'num_unread_general': this.get('num_unread_general') + 1});
                        if (this.isUserMentioned(body.textContent)) {
                            this.save({'num_unread': this.get('num_unread') + 1});
                            _converse.incrementMsgCounter();
                        }
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
                },

                parsePresence (pres) {
                    const id = Strophe.getResourceFromJid(pres.getAttribute("from"));
                    const data = {
                        nick: id,
                        type: pres.getAttribute("type"),
                        states: []
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
                                }
                        }
                    });
                    return data;
                },

                updateOccupantsOnPresence (pres) {
                    /* Given a presence stanza, update the occupant models
                     * based on its contents.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The presence stanza
                     */
                    const data = this.parsePresence(pres);
                    if (data.type === 'error') {
                        return true;
                    }
                    const occupant = this.findOccupant(data);
                    if (data.type === 'unavailable') {
                        if (occupant) { occupant.destroy(); }
                    } else {
                        const jid = Strophe.getBareJidFromJid(data.jid);
                        const attributes = _.extend(data, {
                            'jid': jid ? jid : undefined,
                            'resource': data.jid ? Strophe.getResourceFromJid(data.jid) : undefined
                        });
                        if (occupant) {
                            occupant.save(attributes);
                        } else {
                            this.create(attributes);
                        }
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
                    const chatroom = _converse.openChatRoom({
                        'jid': room_jid,
                        'password': x_el.getAttribute('password')
                    });
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

            _converse.getChatRoom = function (jid, attrs, fetcher) {
                jid = jid.toLowerCase();
                return _converse.getViewForChatBox(
                    fetcher(_.extend({
                            'id': jid,
                            'jid': jid,
                            'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                            'type': converse.CHATROOMS_TYPE,
                            'box_id': b64_sha1(jid)
                        }, attrs),
                        attrs.bring_to_foreground
                    ));
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
                    'open' (jids, attrs) {
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
                            throw new TypeError('rooms.open: You need to provide at least one JID');
                        } else if (_.isString(jids)) {
                            return _converse.getChatRoom(jids, attrs, _converse.openChatRoom);
                        }
                        return _.map(jids, _.partial(_converse.getChatRoom, _, attrs, _converse.openChatRoom));
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
                                    result.push(_converse.getViewForChatBox(chatbox));
                                }
                            });
                            return result;
                        }
                        const fetcher = _.partial(_converse.chatboxviews.getChatBox.bind(_converse.chatboxviews), _, create);
                        if (!attrs.nick) {
                            attrs.nick = Strophe.getNodeFromJid(_converse.bare_jid);
                        }
                        if (_.isString(jids)) {
                            return _converse.getChatRoom(jids, attrs, fetcher);
                        }
                        return _.map(jids, _.partial(_converse.getChatRoom, _, attrs, fetcher));
                    }
                }
            });
            /************************ END API ************************/
        }
    });
}));
