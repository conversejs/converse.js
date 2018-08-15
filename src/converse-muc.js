// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define([
            "utils/form",
            "converse-core",
            "emojione",
            "converse-disco",
            "backbone.overview",
            "backbone.orderedlistview",
            "backbone.vdomview",
            "utils/muc"
    ], factory);
}(this, function (u, converse, emojione) {
    "use strict";

    const MUC_ROLE_WEIGHTS = {
        'moderator':    1,
        'participant':  2,
        'visitor':      3,
        'none':         2,
    };

    const { Strophe, Backbone, Promise, $iq, $build, $msg, $pres, b64_sha1, sizzle, f, moment, _ } = converse.env;

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

            tearDown () {
                const groupchats = this.chatboxes.where({'type': converse.CHATROOMS_TYPE});
                _.each(groupchats, function (groupchat) {
                    u.safeSave(groupchat, {'connection_status': converse.ROOMSTATUS.DISCONNECTED});
                });
                this.__super__.tearDown.call(this, arguments);
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
                /* Opens a groupchat, making sure that certain attributes
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
                          'nick': _converse.xmppstatus.get('nickname') || _converse.nickname,
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
                     * groupchat
                     */
                    const room_jid = this.get('jid');
                    this.removeHandlers();
                    this.presence_handler = _converse.connection.addHandler((stanza) => {
                            _.each(_.values(this.handlers.presence), (callback) => callback(stanza));
                            this.onPresence(stanza);
                            return true;
                        },
                        null, 'presence', null, null, room_jid,
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
                     * registered for this groupchat.
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

                getDisplayName () {
                    return this.get('name') || this.get('jid');
                },

                join (nick, password) {
                    /* Join the groupchat.
                     *
                     * Parameters:
                     *  (String) nick: The user's nickname
                     *  (String) password: Optional password, if required by
                     *      the groupchat.
                     */
                    nick = nick ? nick : this.get('nick');
                    if (!nick) {
                        throw new TypeError('join: You need to provide a valid nickname');
                    }
                    if (this.get('connection_status') === converse.ROOMSTATUS.ENTERED) {
                        // We have restored a groupchat from session storage,
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
                    /* Leave the groupchat.
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

                getReferenceForMention (mention, index) {
                    const longest_match = u.getLongestSubstring(mention, this.occupants.map(o => o.get('nick')));
                    if (!longest_match) {
                        return null;
                    }
                    if ((mention[longest_match.length] || '').match(/[A-Za-zäëïöüâêîôûáéíóúàèìòùÄËÏÖÜÂÊÎÔÛÁÉÍÓÚÀÈÌÒÙ]/i)) {
                        // avoid false positives, i.e. mentions that have
                        // further alphabetical characters than our longest
                        // match.
                        return null;
                    }
                    const occupant = this.occupants.findOccupant({'nick': longest_match});
                    if (!occupant) {
                        return null;
                    }
                    const obj = {
                        'begin': index,
                        'end': index + longest_match.length,
                        'type': 'mention'
                    };
                    if (occupant.get('jid')) {
                        obj.uri = `xmpp:${occupant.get('jid')}`
                    }
                    return obj;
                },

                extractReference (text, index) {
                    for (let i=index; i<text.length; i++) {
                        if (text[i] !== '@') {
                            continue
                        } else {
                            const match = text.slice(i+1),
                                  ref = this.getReferenceForMention(match, i)
                            if (ref) {
                                return [text.slice(0, i) + match, ref, i]
                            }
                        }
                    }
                    return;
                },

                parseForReferences (text) {
                    const refs = [];
                    let index = 0;
                    while (index < (text || '').length) {
                        const result = this.extractReference(text, index);
                        if (result) {
                            text = result[0]; // @ gets filtered out
                            refs.push(result[1]);
                            index = result[2];
                        } else {
                            break;
                        }
                    }
                    return [text, refs];
                },

                getOutgoingMessageAttributes (text, spoiler_hint) {
                    const is_spoiler = this.get('composing_spoiler');
                    var references;
                    [text, references] = this.parseForReferences(text);

                    return {
                        'from': `${this.get('jid')}/${this.get('nick')}`,
                        'fullname': this.get('nick'),
                        'is_spoiler': is_spoiler,
                        'message': text ? u.httpToGeoUri(emojione.shortnameToUnicode(text), _converse) : undefined,
                        'nick': this.get('nick'),
                        'references': references,
                        'sender': 'me',
                        'spoiler_hint': is_spoiler ? spoiler_hint : undefined,
                        'type': 'groupchat'
                    };
                },

                getRoomFeatures () {
                    /* Fetch the groupchat disco info, parse it and then save it.
                     */
                    return new Promise((resolve, reject) => {
                        _converse.api.disco.info(this.get('jid'), null)
                            .then((stanza) => {
                                this.parseRoomFeatures(stanza);
                                resolve()
                            }).catch((err) => {
                                _converse.log("Could not parse the groupchat features", Strophe.LogLevel.WARN);
                                _converse.log(err, Strophe.LogLevel.WARN);
                                reject(err);
                            });
                    });
                },

                getRoomJIDAndNick (nick) {
                    /* Utility method to construct the JID for the current user
                     * as occupant of the groupchat.
                     *
                     * This is the groupchat JID, with the user's nick added at the
                     * end.
                     *
                     * For example: groupchat@conference.example.org/nickname
                     */
                    if (nick) {
                        this.save({'nick': nick});
                    } else {
                        nick = this.get('nick');
                    }
                    const groupchat = this.get('jid');
                    const jid = Strophe.getBareJidFromJid(groupchat);
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
                        // When inviting to a members-only groupchat, we first add
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
                    /* Parses an IQ stanza containing the groupchat's features.
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
                        'features_fetched': moment().format(),
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
                     * member-list of this groupchat.
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
                    affiliation = affiliation || 'member';
                    const iq = $iq({to: this.get('jid'), type: "get"})
                        .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                            .c("item", {'affiliation': affiliation});
                    return _converse.api.sendIQ(iq);
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
                    /* Submit the groupchat configuration form by sending an IQ
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
                    /* Automatically configure groupchat based on this model's
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
                    /* Send an IQ stanza to fetch the groupchat configuration data.
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
                    /* Send an IQ stanza with the groupchat configuration.
                     *
                     * Parameters:
                     *  (Array) config: The groupchat configuration
                     *  (Function) callback: Callback upon succesful IQ response
                     *      The first parameter passed in is IQ containing the
                     *      groupchat configuration.
                     *      The second is the response IQ from the server.
                     *  (Function) errback: Callback upon error IQ response
                     *      The first parameter passed in is IQ containing the
                     *      groupchat configuration.
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
                     * affiliations in this groupchat.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (Object) members: A map of jids, affiliations and optionally reasons
                     *  (Function) onSuccess: callback for a succesful response
                     *  (Function) onError: callback for an error response
                     */
                    const affiliations = _.uniq(_.map(members, 'affiliation'));
                    return Promise.all(_.map(affiliations, _.partial(this.setAffiliation.bind(this), _, members)));
                },

                getJidsWithAffiliations (affiliations) {
                    /* Returns a map of JIDs that have the affiliations
                     * as provided.
                     */
                    if (_.isString(affiliations)) {
                        affiliations = [affiliations];
                    }
                    const promises = _.map(
                        affiliations,
                        _.partial(this.requestMemberList.bind(this))
                    );
                    return Promise.all(promises).then(
                        (iq) => u.marshallAffiliationIQs(iq),
                        (iq) => u.marshallAffiliationIQs(iq)
                    );
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
                    this.getJidsWithAffiliations(affiliations)
                        .then((old_members) => this.setAffiliations(deltaFunc(members, old_members)))
                        .then(() => this.occupants.fetchMembers())
                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
                },

                checkForReservedNick (callback, errback) {
                    /* Use service-discovery to ask the XMPP server whether
                     * this user has a reserved nickname for this groupchat.
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
                    if (data.type === 'unavailable' && occupant) {
                        if (!_.includes(data.states, converse.MUC_NICK_CHANGED_CODE) && !occupant.isMember()) {
                            // We only destroy the occupant if this is not a nickname change operation.
                            // and if they're not on the member lists.
                            // Before destroying we set the new data, so
                            // that we can show the disconnection message.
                            occupant.set(data);
                            occupant.destroy();
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
                          type = pres.getAttribute("type"),
                          data = {
                            'from': from,
                            'nick': Strophe.getResourceFromJid(from),
                            'type': type,
                            'states': [],
                            'show': type !== 'unavailable' ? 'online' : 'offline'
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
                    /* Handler for all MUC messages sent to this groupchat.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message stanza.
                     */
                    this.fetchFeaturesIfConfigurationChanged(stanza);

                    const original_stanza = stanza,
                          forwarded = stanza.querySelector('forwarded');
                    if (!_.isNull(forwarded)) {
                        stanza = forwarded.querySelector('message');
                    }
                    if (this.isDuplicate(stanza, original_stanza)) {
                        return;
                    }
                    const jid = stanza.getAttribute('from'),
                          resource = Strophe.getResourceFromJid(jid),
                          sender = resource && Strophe.unescapeNode(resource) || '';

                    if (!this.handleMessageCorrection(stanza)) {
                        const subject = _.propertyOf(stanza.querySelector('subject'))('textContent');
                        if (subject) {
                            u.safeSave(this, {'subject': {'author': sender, 'text': subject}});
                        }
                        if (sender === '') {
                            return;
                        }
                        this.incrementUnreadMsgCounter(original_stanza);
                        this.createMessage(stanza, original_stanza);
                    }
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
                     * For locked groupchats (which are by definition "new"), the
                     * groupchat will either be auto-configured or created instantly
                     * (with default config) or a configuration groupchat will be
                     * rendered.
                     *
                     * If the groupchat is not locked, then the groupchat will be
                     * auto-configured only if applicable and if the current
                     * user is the groupchat's owner.
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
                            return; // We haven't yet entered the groupchat, so bail here.
                        }
                    } else if (!this.get('features_fetched')) {
                        // The features for this groupchat weren't fetched.
                        // That must mean it's a new groupchat without locking
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
                    if (u.isNewMessage(stanza) && this.isHidden()) {
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
                    const hash = this.get('image_hash');
                    const vcards = [];
                    if (this.get('jid')) {
                        vcards.push(_converse.vcards.findWhere({'jid': this.get('jid')}));
                    }
                    vcards.push(_converse.vcards.findWhere({'jid': this.get('from')}));

                    _.forEach(_.filter(vcards, undefined), (vcard) => {
                        if (hash && vcard.get('image_hash') !== hash) {
                            _converse.api.vcard.update(vcard);
                        }
                    });
                },

                getDisplayName () {
                    return this.get('nick') || this.get('jid');
                },

                isMember () {
                    return _.includes(['admin', 'owner', 'member'], this.get('affiliation'));
                }
            });


            _converse.ChatRoomOccupants = Backbone.Collection.extend({
                model: _converse.ChatRoomOccupant,

                comparator (occupant1, occupant2) {
                    const role1 = occupant1.get('role') || 'none';
                    const role2 = occupant2.get('role') || 'none';
                    if (MUC_ROLE_WEIGHTS[role1] === MUC_ROLE_WEIGHTS[role2]) {
                        const nick1 = occupant1.getDisplayName().toLowerCase();
                        const nick2 = occupant2.getDisplayName().toLowerCase();
                        return nick1 < nick2 ? -1 : (nick1 > nick2? 1 : 0);
                    } else  {
                        return MUC_ROLE_WEIGHTS[role1] < MUC_ROLE_WEIGHTS[role2] ? -1 : 1;
                    }
                },

                fetchMembers () {
                    this.chatroom.getJidsWithAffiliations(['member', 'owner', 'admin'])
                    .then((new_members) => {
                        const new_jids = new_members.map(m => m.jid).filter(m => !_.isUndefined(m)),
                              new_nicks = new_members.map(m => !m.jid && m.nick || undefined).filter(m => !_.isUndefined(m)),
                              removed_members = this.filter(m => {
                                  return f.includes(m.get('affiliation'), ['admin', 'member', 'owner']) &&
                                      !f.includes(m.get('nick'), new_nicks) &&
                                        !f.includes(m.get('jid'), new_jids);
                              });

                        _.each(removed_members, (occupant) => {
                            if (occupant.get('jid') === _converse.bare_jid) { return; }
                            if (occupant.get('show') === 'offline') {
                                occupant.destroy();
                            }
                        });
                        _.each(new_members, (attrs) => {
                            let occupant;
                            if (attrs.jid) {
                                occupant = this.findOccupant({'jid': attrs.jid});
                            } else {
                                occupant = this.findOccupant({'nick': attrs.nick});
                            }
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
                /* A direct MUC invitation to join a groupchat has been received
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
                            __("%1$s has invited you to join a groupchat: %2$s", contact, room_jid)
                        );
                    } else {
                        result = confirm(
                            __('%1$s has invited you to join a groupchat: %2$s, and left the following reason: "%3$s"',
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
                        (message) =>  {
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
                /* Automatically join groupchats, based on the
                 * "auto_join_rooms" configuration setting, which is an array
                 * of strings (groupchat JIDs) or objects (with groupchat JID and other
                 * settings).
                 */
                _.each(_converse.auto_join_rooms, function (groupchat) {
                    if (_converse.chatboxes.where({'jid': groupchat}).length) {
                        return;
                    }
                    if (_.isString(groupchat)) {
                        _converse.api.rooms.open(groupchat);
                    } else if (_.isObject(groupchat)) {
                        _converse.api.rooms.open(groupchat.jid, groupchat.nick);
                    } else {
                        _converse.log(
                            'Invalid groupchat criteria specified for "auto_join_rooms"',
                            Strophe.LogLevel.ERROR);
                    }
                });
                _converse.emit('roomsAutoJoined');
            }

            function disconnectChatRooms () {
                /* When disconnecting, mark all groupchats as
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
                    _converse.api.disco.own.features.add(Strophe.NS.MUC);
                }
                if (_converse.allow_muc_invitations) {
                    _converse.api.disco.own.features.add('jabber:x:conference'); // Invites
                }
            });
            _converse.api.listen.on('chatBoxesFetched', autoJoinRooms);
            _converse.api.listen.on('disconnecting', disconnectChatRooms);

            _converse.api.listen.on('statusInitialized', () => {
                // XXX: For websocket connections, we disconnect from all
                // chatrooms when the page reloads. This is a workaround for
                // issue #1111 and should be removed once we support XEP-0198
                const options = {'once': true, 'passive': true};
                window.addEventListener(_converse.unloadevent, () => {
                    if (_converse.connection._proto instanceof Strophe.Websocket) {
                        disconnectChatRooms();
                    }
                });
            });
            /************************ END Event Handlers ************************/


            /************************ BEGIN API ************************/
            // We extend the default converse.js API to add methods specific to MUC groupchats.
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
                        return new Promise((resolve, reject) => {
                            _converse.api.waitUntil('chatBoxesFetched').then(() => {
                                if (_.isUndefined(jids)) {
                                    const err_msg = 'rooms.open: You need to provide at least one JID';
                                    _converse.log(err_msg, Strophe.LogLevel.ERROR);
                                    reject(new TypeError(err_msg));
                                } else if (_.isString(jids)) {
                                    resolve(_converse.api.rooms.create(jids, attrs).trigger('show'));
                                } else {
                                    resolve(_.map(jids, (jid) => _converse.api.rooms.create(jid, attrs).trigger('show')));
                                }
                            });
                        });
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
