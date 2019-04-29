// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
//
// XEP-0045 Multi-User Chat

import "./converse-disco";
import "./utils/emoji";
import "./utils/muc";
import converse from "./converse-core";
import u from "./utils/form";

const MUC_ROLE_WEIGHTS = {
    'moderator':    1,
    'participant':  2,
    'visitor':      3,
    'none':         2,
};

const { Strophe, Backbone, Promise, $iq, $build, $msg, $pres, sizzle, f, moment, _ } = converse.env;

// Add Strophe Namespaces
Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");

converse.MUC_NICK_CHANGED_CODE = "303";

converse.ROOM_FEATURES = [
    'passwordprotected', 'unsecured', 'hidden',
    'publicroom', 'membersonly', 'open', 'persistent',
    'temporary', 'nonanonymous', 'semianonymous',
    'moderated', 'unmoderated', 'mam_enabled'
];

// No longer used in code, but useful as reference.
//
// const ROOM_FEATURES_MAP = {
//     'passwordprotected': 'unsecured',
//     'unsecured': 'passwordprotected',
//     'hidden': 'publicroom',
//     'publicroom': 'hidden',
//     'membersonly': 'open',
//     'open': 'membersonly',
//     'persistent': 'temporary',
//     'temporary': 'persistent',
//     'nonanonymous': 'semianonymous',
//     'semianonymous': 'nonanonymous',
//     'moderated': 'unmoderated',
//     'unmoderated': 'moderated'
// };

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
        tearDown () {
            const { _converse } = this.__super__,
                  groupchats = this.chatboxes.where({'type': _converse.CHATROOMS_TYPE});

            _.each(groupchats, gc => u.safeSave(gc, {'connection_status': converse.ROOMSTATUS.DISCONNECTED}));
            this.__super__.tearDown.call(this, arguments);
        },

        ChatBoxes: {
            model (attrs, options) {
                const { _converse } = this.__super__;
                if (attrs.type == _converse.CHATROOMS_TYPE) {
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
            auto_register_muc_nickname: false,
            muc_history_max_stanzas: undefined,
            muc_instant_rooms: true,
            muc_nickname_from_jid: false
        });
        _converse.api.promises.add(['roomsAutoJoined']);


        async function openRoom (jid) {
            if (!u.isValidMUCJID(jid)) {
                return _converse.log(
                    `Invalid JID "${jid}" provided in URL fragment`,
                    Strophe.LogLevel.WARN
                );
            }
            await _converse.api.waitUntil('roomsAutoJoined');
            if (_converse.allow_bookmarks) {
                await _converse.api.waitUntil('bookmarksInitialized');
            }
            _converse.api.rooms.open(jid);
        }
        _converse.router.route('converse/room?jid=:jid', openRoom);


        _converse.getDefaultMUCNickname = function () {
            // XXX: if anything changes here, update the docs for the
            // locked_muc_nickname setting.
            if (!_converse.xmppstatus) {
                throw new Error(
                    "Can't call _converse.getDefaultMUCNickname before the statusInitialized has been fired.");
            }
            const nick = _converse.nickname || (_converse.vcards ? _converse.xmppstatus.vcard.get('nickname') : undefined);
            if (nick) {
                return nick;
            } else if (_converse.muc_nickname_from_jid) {
                return Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.bare_jid));
            }
        }

        function openChatRoom (jid, settings) {
            /* Opens a groupchat, making sure that certain attributes
             * are correct, for example that the "type" is set to
             * "chatroom".
             */
            settings.type = _converse.CHATROOMS_TYPE;
            settings.id = jid;
            const chatbox = _converse.chatboxes.getChatBox(jid, settings, true);
            chatbox.maybeShow(true);
            return chatbox;
        }

        /**
         * Represents an open/ongoing groupchat conversation.
         *
         * @class
         * @namespace _converse.ChatRoom
         * @memberOf _converse
         */
        _converse.ChatRoom = _converse.ChatBox.extend({

            defaults () {
                return {
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
                    'bookmarked': false,
                    'chat_state': undefined,
                    'connection_status': converse.ROOMSTATUS.DISCONNECTED,
                    'description': '',
                    'hidden': _.includes(['mobile', 'fullscreen'], _converse.view_mode),
                    'message_type': 'groupchat',
                    'name': '',
                    'nick': _converse.xmppstatus.get('nickname') || _converse.nickname,
                    'num_unread': 0,
                    'roomconfig': {},
                    'time_opened': this.get('time_opened') || moment().valueOf(),
                    'type': _converse.CHATROOMS_TYPE
                }
            },

            initialize() {
                if (_converse.vcards) {
                    this.vcard = _converse.vcards.findWhere({'jid': this.get('jid')}) ||
                        _converse.vcards.create({'jid': this.get('jid')});
                }
                this.set('box_id', `box-${btoa(this.get('jid'))}`);

                this.initMessages();
                this.on('change:chat_state', this.sendChatState, this);
                this.on('change:connection_status', this.onConnectionStatusChanged, this);

                const storage = _converse.config.get('storage');
                const id = `converse.muc-features-${_converse.bare_jid}-${this.get('jid')}`;
                this.features = new Backbone.Model(
                    _.assign({id}, _.zipObject(converse.ROOM_FEATURES, _.map(converse.ROOM_FEATURES, _.stubFalse)))
                );
                this.features.browserStorage = new Backbone.BrowserStorage.session(id);
                this.features.fetch();

                this.occupants = new _converse.ChatRoomOccupants();
                this.occupants.browserStorage = new Backbone.BrowserStorage.session(
                    `converse.occupants-${_converse.bare_jid}${this.get('jid')}`
                );
                this.occupants.chatroom  = this;
                this.registerHandlers();
            },

            async onConnectionStatusChanged () {
                if (this.get('connection_status') === converse.ROOMSTATUS.ENTERED &&
                        _converse.auto_register_muc_nickname &&
                        !this.get('reserved_nick')) {

                    const result = await _converse.api.disco.supports(Strophe.NS.MUC_REGISTER, this.get('jid'));
                    if (result.length) {
                        this.registerNickname()
                    }
                }
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

            /**
             * Join the groupchat.
             * @private
             * @method _converse.ChatRoom#join
             * @param { String } nick - The user's nickname
             * @param { String } password - Optional password, if required by the groupchat.
             */
            join (nick, password) {
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
                  .c("history", {'maxstanzas': this.features.get('mam_enabled') ? 0 : _converse.muc_history_max_stanzas}).up();

                if (password) {
                    stanza.cnode(Strophe.xmlElement("password", [], password));
                }
                this.save('connection_status', converse.ROOMSTATUS.CONNECTING);
                _converse.api.send(stanza);
                return this;
            },

            /* Leave the groupchat.
             * @private
             * @method _converse.ChatRoom#leave
             * @param { string } exit_msg - Optional message to indicate your reason for leaving
             */
            leave (exit_msg) {
                this.features.destroy();
                this.occupants.browserStorage._clear();
                this.occupants.reset();
                if (_converse.disco_entities) {
                    const disco_entity = _converse.disco_entities.get(this.get('jid'));
                    if (disco_entity) {
                        disco_entity.destroy();
                    }
                }
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
                const longest_match = u.getLongestSubstring(
                    mention,
                    this.occupants.map(o => o.getDisplayName())
                );
                if (!longest_match) {
                    return null;
                }
                if ((mention[longest_match.length] || '').match(/[A-Za-zäëïöüâêîôûáéíóúàèìòùÄËÏÖÜÂÊÎÔÛÁÉÍÓÚÀÈÌÒÙ]/i)) {
                    // avoid false positives, i.e. mentions that have
                    // further alphabetical characters than our longest
                    // match.
                    return null;
                }
                const occupant = this.occupants.findOccupant({'nick': longest_match}) ||
                        this.occupants.findOccupant({'jid': longest_match});
                if (!occupant) {
                    return null;
                }
                const obj = {
                    'begin': index,
                    'end': index + longest_match.length,
                    'value': longest_match,
                    'type': 'mention'
                };
                if (occupant.get('jid')) {
                    obj.uri = `xmpp:${occupant.get('jid')}`
                }
                return obj;
            },

            extractReference (text, index) {
                for (let i=index; i<text.length; i++) {
                    if (text[i] === '@' && (i === 0 || text[i - 1] === ' ')) {
                        const match = text.slice(i+1),
                              ref = this.getReferenceForMention(match, i);
                        if (ref) {
                            return [text.slice(0, i) + match, ref, i]
                        }
                    }
                }
                return;
            },

            parseTextForReferences (text) {
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
                [text, references] = this.parseTextForReferences(text);
                const origin_id = _converse.connection.getUniqueId();

                return {
                    'msgid': origin_id,
                    'origin_id': origin_id,
                    'from': `${this.get('jid')}/${this.get('nick')}`,
                    'fullname': this.get('nick'),
                    'is_single_emoji': text ? u.isSingleEmoji(text) : false,
                    'is_spoiler': is_spoiler,
                    'message': text ? u.httpToGeoUri(u.shortnameToUnicode(text), _converse) : undefined,
                    'nick': this.get('nick'),
                    'references': references,
                    'sender': 'me',
                    'spoiler_hint': is_spoiler ? spoiler_hint : undefined,
                    'type': 'groupchat'
                };
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
                if (!_converse.send_chat_state_notifications || this.get('connection_status') !== converse.ROOMSTATUS.ENTERED) {
                    return;
                }
                const chat_state = this.get('chat_state');
                if (chat_state === _converse.GONE) {
                    // <gone/> is not applicable within MUC context
                    return;
                }
                _converse.api.send(
                    $msg({'to':this.get('jid'), 'type': 'groupchat'})
                        .c(chat_state, {'xmlns': Strophe.NS.CHATSTATES}).up()
                        .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                        .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                );
            },

            /**
             * Send a direct invitation as per XEP-0249
             * @private
             * @method _converse.ChatRoom#directInvite
             * @param { String } recipient - JID of the person being invited
             * @param { String } reason - Optional reason for the invitation
             */
            directInvite (recipient, reason) {
                if (this.features.get('membersonly')) {
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
                    'from': _converse.connection.jid,
                    'to': recipient,
                    'id': _converse.connection.getUniqueId()
                }).c('x', attrs);
                _converse.api.send(invitation);
                /**
                 * After the user has sent out a direct invitation (as per XEP-0249),
                 * to a roster contact, asking them to join a room.
                 * @event _converse#chatBoxMaximized
                 * @type { object }
                 * @property { _converse.ChatRoom } room
                 * @property { string } recipient - The JID of the person being invited
                 * @property { string } reason - The original reason for the invitation
                 * @example _converse.api.listen.on('chatBoxMaximized', view => { ... });
                 */
                _converse.api.trigger('roomInviteSent', {
                    'room': this,
                    'recipient': recipient,
                    'reason': reason
                });
            },

            async refreshRoomFeatures () {
                await _converse.api.disco.refreshFeatures(this.get('jid'));
                return this.getRoomFeatures();
            },

            async getRoomFeatures () {
                let identity;
                try {
                    identity = await _converse.api.disco.getIdentity('conference', 'text', this.get('jid'));
                } catch (e) {
                    // Getting the identity probably failed because this room doesn't exist yet.
                    return _converse.log(e, Strophe.LogLevel.ERROR);
                }
                const fields = await _converse.api.disco.getFields(this.get('jid'));
                this.save({
                    'name': identity && identity.get('name'),
                    'description': _.get(fields.findWhere({'var': "muc#roominfo_description"}), 'attributes.value')
                });

                const features = await _converse.api.disco.getFeatures(this.get('jid'));
                const attrs = Object.assign(
                    _.zipObject(converse.ROOM_FEATURES, _.map(converse.ROOM_FEATURES, _.stubFalse)),
                    {'fetched': moment().format()}
                );
                features.each(feature => {
                    const fieldname = feature.get('var');
                    if (!fieldname.startsWith('muc_')) {
                        if (fieldname === Strophe.NS.MAM) {
                            attrs.mam_enabled = true;
                        }
                        return;
                    }
                    attrs[fieldname.replace('muc_', '')] = true;
                });
                this.features.save(attrs);
            },

            /* Send an IQ stanza to the server, asking it for the
             * member-list of this groupchat.
             * See: https://xmpp.org/extensions/xep-0045.html#modifymember
             * @private
             * @method _converse.ChatRoom#requestMemberList
             * @param { string } affiliation - The specific member list to
             *      fetch. 'admin', 'owner' or 'member'.
             * @returns:
             *  A promise which resolves once the list has been retrieved.
             */
            requestMemberList (affiliation) {
                affiliation = affiliation || 'member';
                const iq = $iq({to: this.get('jid'), type: "get"})
                    .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                        .c("item", {'affiliation': affiliation});
                return _converse.api.sendIQ(iq);
            },

            /**
             * Send IQ stanzas to the server to set an affiliation for
             * the provided JIDs.
             * See: https://xmpp.org/extensions/xep-0045.html#modifymember
             *
             * Prosody doesn't accept multiple JIDs' affiliations
             * being set in one IQ stanza, so as a workaround we send
             * a separate stanza for each JID.
             * Related ticket: https://issues.prosody.im/345
             *
             * @private
             * @method _converse.ChatRoom#setAffiliation
             * @param { string } affiliation - The affiliation
             * @param { object } members - A map of jids, affiliations and
             *      optionally reasons. Only those entries with the
             *      same affiliation as being currently set will be considered.
             * @returns
             *  A promise which resolves and fails depending on the XMPP server response.
             */
            setAffiliation (affiliation, members) {
                members = _.filter(members, (member) =>
                    // We only want those members who have the right
                    // affiliation (or none, which implies the provided one).
                    _.isUndefined(member.affiliation) ||
                            member.affiliation === affiliation
                );
                const promises = _.map(members, _.bind(this.sendAffiliationIQ, this, affiliation));
                return Promise.all(promises);
            },

            /**
             * Submit the groupchat configuration form by sending an IQ
             * stanza to the server.
             * @private
             * @method _converse.ChatRoom#saveConfiguration
             * @param { HTMLElement } form - The configuration form DOM element.
             *      If no form is provided, the default configuration
             *      values will be used.
             * @returns { promise }
             * Returns a promise which resolves once the XMPP server
             * has return a response IQ.
             */
            saveConfiguration (form) {
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
                return _converse.api.sendIQ(
                    $iq({'to': this.get('jid'), 'type': "get"})
                     .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                );
            },

            /**
             * Send an IQ stanza with the groupchat configuration.
             * @private
             * @method _converse.ChatRoom#sendConfiguration
             * @param { Array } config - The groupchat configuration
             * @param { Function } callback - Callback upon succesful IQ response
             *      The first parameter passed in is IQ containing the
             *      groupchat configuration.
             *      The second is the response IQ from the server.
             * @param { Function } errback - Callback upon error IQ response
             *      The first parameter passed in is IQ containing the
             *      groupchat configuration.
             *      The second is the response IQ from the server.
             */
            sendConfiguration (config, callback, errback) {
                const iq = $iq({to: this.get('jid'), type: "set"})
                    .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                    .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                _.each(config || [], function (node) { iq.cnode(node).up(); });
                callback = _.isUndefined(callback) ? _.noop : _.partial(callback, iq.nodeTree);
                errback = _.isUndefined(errback) ? _.noop : _.partial(errback, iq.nodeTree);
                return _converse.api.sendIQ(iq).then(callback).catch(errback);
            },

            /**
             * Parse the presence stanza for the current user's affiliation.
             * @private
             * @method _converse.ChatRoom#saveAffiliationAndRole
             * @param { XMLElement } pres - A <presence> stanza.
             */
            saveAffiliationAndRole (pres) {
                const item = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"] item`, pres).pop();
                const is_self = !_.isNull(pres.querySelector("status[code='110']"));
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

            /**
             * Send an IQ stanza specifying an affiliation change.
             * @private
             * @method _converse.ChatRoom#
             * @param { String } affiliation: affiliation
             *     (could also be stored on the member object).
             * @param { Object } member: Map containing the member's jid and
             *     optionally a reason and affiliation.
             */
            sendAffiliationIQ (affiliation, member) {
                const iq = $iq({to: this.get('jid'), type: "set"})
                    .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                    .c("item", {
                        'affiliation': member.affiliation || affiliation,
                        'nick': member.nick,
                        'jid': member.jid
                    });
                if (!_.isUndefined(member.reason)) {
                    iq.c("reason", member.reason);
                }
                return _converse.api.sendIQ(iq);
            },

            /**
             * Send IQ stanzas to the server to modify the
             * affiliations in this groupchat.
             * See: https://xmpp.org/extensions/xep-0045.html#modifymember
             * @private
             * @method _converse.ChatRoom#setAffiliations
             * @param { object } members - A map of jids, affiliations and optionally reasons
             * @param { function } onSuccess - callback for a succesful response
             * @param { function } onError - callback for an error response
             */
            setAffiliations (members) {
                const affiliations = _.uniq(_.map(members, 'affiliation'));
                return Promise.all(_.map(affiliations, _.partial(this.setAffiliation.bind(this), _, members)));
            },

            async getJidsWithAffiliations (affiliations) {
                /* Returns a map of JIDs that have the affiliations
                 * as provided.
                 */
                if (_.isString(affiliations)) {
                    affiliations = [affiliations];
                }
                const result = await Promise.all(affiliations.map(a =>
                    this.requestMemberList(a)
                        .then(iq => u.parseMemberListIQ(iq))
                        .catch(iq => {
                            _converse.log(iq, Strophe.LogLevel.ERROR);
                        })
                ));
                return [].concat.apply([], result).filter(p => p);
            },

            /**
             * Fetch the lists of users with the given affiliations.
             * Then compute the delta between those users and
             * the passed in members, and if it exists, send the delta
             * to the XMPP server to update the member list.
             * @private
             * @method _converse.ChatRoom#updateMemberLists
             * @param { object } members - Map of member jids and affiliations.
             * @param { string|array } affiliation - An array of affiliations or
             *      a string if only one affiliation.
             * @param { function } deltaFunc - The function to compute the delta
             *      between old and new member lists.
             * @returns { promise } 
             *  A promise which is resolved once the list has been
             *  updated or once it's been established there's no need
             *  to update the list.
             */
            updateMemberLists (members, affiliations, deltaFunc) {
                this.getJidsWithAffiliations(affiliations)
                    .then(old_members => this.setAffiliations(deltaFunc(members, old_members)))
                    .then(() => this.occupants.fetchMembers())
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.ERROR));
            },

            /**
             * Use service-discovery to ask the XMPP server whether
             * this user has a reserved nickname for this groupchat.
             * If so, we'll use that, otherwise we render the nickname form.
             * @private
             * @method _converse.ChatRoom#checkForReservedNick
             * @returns { promise } A promise which resolves with the response IQ
             */
            async checkForReservedNick () {
                const iq = await _converse.api.sendIQ(
                    $iq({
                        'to': this.get('jid'),
                        'from': _converse.connection.jid,
                        'type': "get"
                    }).c("query", {
                        'xmlns': Strophe.NS.DISCO_INFO,
                        'node': 'x-roomuser-item'
                    })
                );
                const identity_el = iq.querySelector('query[node="x-roomuser-item"] identity'),
                      nick = identity_el ? identity_el.getAttribute('name') : null;
                this.save({
                    'reserved_nick': nick,
                    'nick': nick
                }, {'silent': true});
                return iq;
            },

            async registerNickname () {
                // See https://xmpp.org/extensions/xep-0045.html#register
                const nick = this.get('nick'),
                      jid = this.get('jid');
                let iq, err_msg;
                try {
                    iq = await _converse.api.sendIQ(
                        $iq({
                            'to': jid,
                            'from': _converse.connection.jid,
                            'type': 'get'
                        }).c('query', {'xmlns': Strophe.NS.MUC_REGISTER})
                    );
                } catch (e) {
                    if (sizzle('not-allowed[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', e).length) {
                        err_msg = __("You're not allowed to register yourself in this groupchat.");
                    } else if (sizzle('registration-required[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', e).length) {
                        err_msg = __("You're not allowed to register in this groupchat because it's members-only.");
                    }
                    _converse.log(e, Strophe.LogLevel.ERROR);
                    return err_msg;
                }
                const required_fields = sizzle('field required', iq).map(f => f.parentElement);
                if (required_fields.length > 1 && required_fields[0].getAttribute('var') !== 'muc#register_roomnick') {
                    return _converse.log(`Can't register the user register in the groupchat ${jid} due to the required fields`);
                }
                try {
                    await _converse.api.sendIQ($iq({
                            'to': jid,
                            'from': _converse.connection.jid,
                            'type': 'set'
                        }).c('query', {'xmlns': Strophe.NS.MUC_REGISTER})
                            .c('x', {'xmlns': Strophe.NS.XFORM, 'type': 'submit'})
                                .c('field', {'var': 'FORM_TYPE'}).c('value').t('http://jabber.org/protocol/muc#register').up().up()
                                .c('field', {'var': 'muc#register_roomnick'}).c('value').t(nick)
                    );
                } catch (e) {
                    if (sizzle('service-unavailable[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', e).length) {
                        err_msg = __("Can't register your nickname in this groupchat, it doesn't support registration.");
                    } else if (sizzle('bad-request[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', e).length) {
                        err_msg = __("Can't register your nickname in this groupchat, invalid data form supplied.");
                    }
                    _converse.log(err_msg);
                    _converse.log(e, Strophe.LogLevel.ERROR);
                    return err_msg;
                }
            },

            /**
             * Given a presence stanza, update the occupant model
             * based on its contents.
             * @private
             * @method _converse.ChatRoom#updateOccupantsOnPresence
             * @param { XMLElement } pres - The presence stanza
             */
            updateOccupantsOnPresence (pres) {
                const data = this.parsePresence(pres);
                if (data.type === 'error' || (!data.jid && !data.nick)) {
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
                const jid = data.jid || '';
                const attributes = Object.assign(data, {
                    'jid': Strophe.getBareJidFromJid(jid) || _.get(occupant, 'attributes.jid'),
                    'resource': Strophe.getResourceFromJid(jid) || _.get(occupant, 'attributes.resource')
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

            fetchFeaturesIfConfigurationChanged (stanza) {
                const configuration_changed = stanza.querySelector("status[code='104']"),
                      logging_enabled = stanza.querySelector("status[code='170']"),
                      logging_disabled = stanza.querySelector("status[code='171']"),
                      room_no_longer_anon = stanza.querySelector("status[code='172']"),
                      room_now_semi_anon = stanza.querySelector("status[code='173']"),
                      room_now_fully_anon = stanza.querySelector("status[code='173']");

                if (configuration_changed || logging_enabled || logging_disabled ||
                        room_no_longer_anon || room_now_semi_anon || room_now_fully_anon) {
                    this.refreshRoomFeatures();
                }
            },

            isReceipt (stanza) {
                return sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).length > 0;
            },

            isChatMarker (stanza) {
                return sizzle(
                    `received[xmlns="${Strophe.NS.MARKERS}"],
                     displayed[xmlns="${Strophe.NS.MARKERS}"],
                     acknowledged[xmlns="${Strophe.NS.MARKERS}"]`, stanza).length > 0;
            },

            /**
             * Handle a subject change and return `true` if so.
             * @private
             * @method _converse.ChatRoom#subjectChangeHandled
             * @param { object } attrs - The message attributes
             */
            subjectChangeHandled (attrs) {
                if (attrs.subject && !attrs.thread && !attrs.message) {
                    // https://xmpp.org/extensions/xep-0045.html#subject-mod
                    // -----------------------------------------------------
                    // The subject is changed by sending a message of type "groupchat" to the <room@service>,
                    // where the <message/> MUST contain a <subject/> element that specifies the new subject but
                    // MUST NOT contain a <body/> element (or a <thread/> element).
                    u.safeSave(this, {'subject': {'author': attrs.nick, 'text': attrs.subject || ''}});
                    return true;
                }
                return false;
            },

            /**
             * Is this a chat state notification that can be ignored,
             * because it's old or because it's from us.
             * @private
             * @method _converse.ChatRoom#ignorableCSN
             * @param { Object } attrs - The message attributes
             */
            ignorableCSN (attrs) {
                const is_csn = u.isOnlyChatStateNotification(attrs),
                        own_message = Strophe.getResourceFromJid(attrs.from) == this.get('nick');
                return is_csn && (attrs.is_delayed || own_message);
            },

            getUpdatedMessageAttributes (message, stanza) {
                // Overridden in converse-muc and converse-mam
                const attrs = _converse.ChatBox.prototype.getUpdatedMessageAttributes.call(this, message, stanza);
                const from = stanza.getAttribute('from');
                const own_message = Strophe.getResourceFromJid(from) == this.get('nick');
                if (own_message) {
                    const stanza_id = sizzle(`stanza-id[xmlns="${Strophe.NS.SID}"]`, stanza).pop();
                    const by_jid = stanza_id ? stanza_id.getAttribute('by') : undefined;
                    if (by_jid) {
                        const key = `stanza_id ${by_jid}`;
                        attrs[key] = stanza_id.getAttribute('id');
                    }
                    if (!message.get('received')) {
                        attrs.received = moment().format();
                    }
                }
                return attrs;
            },

            getErrorMessage (stanza) {
                if (sizzle(`forbidden[xmlns="${Strophe.NS.STANZAS}"]`, stanza).length) {
                    return __("Your message was not delivered because you're not allowed to send messages in this groupchat.");
                } else {
                    return _converse.ChatBox.prototype.getErrorMessage.apply(this, arguments);
                }
            },

            /**
             * Handler for all MUC messages sent to this groupchat.
             * @private
             * @method _converse.ChatRoom#onMessage
             * @param { XMLElement } stanza - The message stanza.
             */
            async onMessage (stanza) {
                this.fetchFeaturesIfConfigurationChanged(stanza);

                const original_stanza = stanza,
                      forwarded = sizzle(`forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).pop();
                if (forwarded) {
                    stanza = forwarded.querySelector('message');
                }
                const message = await this.getDuplicateMessage(original_stanza);
                if (message) {
                    this.updateMessage(message, original_stanza);
                }
                if (message ||
                        this.handleMessageCorrection(stanza) ||
                        this.isReceipt(stanza) ||
                        this.isChatMarker(stanza)) {
                    return _converse.api.trigger('message', {'stanza': original_stanza});
                }
                const attrs = await this.getMessageAttributesFromStanza(stanza, original_stanza);

                if (attrs.nick &&
                        !this.subjectChangeHandled(attrs) &&
                        !this.ignorableCSN(attrs) &&
                        (attrs['chat_state'] || !u.isEmptyMessage(attrs))) {

                    const msg = this.messages.create(attrs);
                    this.incrementUnreadMsgCounter(msg);
                    if (forwarded && msg && msg.get('sender')  === 'me') {
                        msg.save({'received': moment().format()});
                    }
                }
                _converse.api.trigger('message', {'stanza': original_stanza, 'chatbox': this});
            },

            /**
             * Handles all MUC presence stanzas.
             * @private
             * @method _converse.ChatRoom#onPresence
             * @param { XMLElement } pres - The stanza
             */
            onPresence (pres) {
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

            /**
             * Handles a received presence relating to the current user.
             *
             * For locked groupchats (which are by definition "new"), the
             * groupchat will either be auto-configured or created instantly
             * (with default config) or a configuration groupchat will be
             * rendered.
             *
             * If the groupchat is not locked, then the groupchat will be
             * auto-configured only if applicable and if the current
             * user is the groupchat's owner.
             * @private
             * @method _converse.ChatRoom#onOwnPresence
             * @param { XMLElement } pres - The stanza
             */
            onOwnPresence (pres) {
                this.saveAffiliationAndRole(pres);

                const locked_room = pres.querySelector("status[code='201']");
                if (locked_room) {
                    if (this.get('auto_configure')) {
                        this.autoConfigureChatRoom().then(() => this.refreshRoomFeatures());
                    } else if (_converse.muc_instant_rooms) {
                        // Accept default configuration
                        this.saveConfiguration().then(() => this.refreshRoomFeatures());
                    } else {
                        /**
                         * Triggered when a new room has been created which first needs to be configured
                         * and when `auto_configure` is set to `false`.
                         * Used by `_converse.ChatRoomView` in order to know when to render the
                         * configuration form for a new room.
                         * @event _converse.ChatRoom#configurationNeeded
                         * @example _converse.api.listen.on('configurationNeeded', () => { ... });
                         */
                        this.trigger('configurationNeeded');
                        return; // We haven't yet entered the groupchat, so bail here.
                    }
                } else if (!this.features.get('fetched')) {
                    // The features for this groupchat weren't fetched.
                    // That must mean it's a new groupchat without locking
                    // (in which case Prosody doesn't send a 201 status),
                    // otherwise the features would have been fetched in
                    // the "initialize" method already.
                    if (this.get('affiliation') === 'owner' && this.get('auto_configure')) {
                        this.autoConfigureChatRoom().then(() => this.refreshRoomFeatures());
                    } else {
                        this.getRoomFeatures();
                    }
                }
                this.save('connection_status', converse.ROOMSTATUS.ENTERED);
            },

            /**
             * Returns a boolean to indicate whether the current user
             * was mentioned in a message.
             * @private
             * @method _converse.ChatRoom#isUserMentioned
             * @param { String } - The text message
             */
            isUserMentioned (message) {
                const nick = this.get('nick');
                if (message.get('references').length) {
                    const mentions = message.get('references').filter(ref => (ref.type === 'mention')).map(ref => ref.value);
                    return _.includes(mentions, nick);
                } else {
                    return (new RegExp(`\\b${nick}\\b`)).test(message.get('message'));
                }
            },

            /* Given a newly received message, update the unread counter if necessary.
             * @private
             * @method _converse.ChatRoom#incrementUnreadMsgCounter
             * @param { XMLElement } - The <messsage> stanza
             */
            incrementUnreadMsgCounter (message) {
                if (!message) { return; }
                const body = message.get('message');
                if (_.isNil(body)) { return; }
                if (u.isNewMessage(message) && this.isHidden()) {
                    const settings = {'num_unread_general': this.get('num_unread_general') + 1};
                    if (this.isUserMentioned(message)) {
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
                'show': 'offline',
                'states': []
            },

            initialize (attributes) {
                this.set(Object.assign(
                    {'id': _converse.connection.getUniqueId()},
                    attributes)
                );
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
                        _converse.api.vcard.update(vcard, true);
                    }
                });
            },

            getDisplayName () {
                return this.get('nick') || this.get('jid');
            },

            isMember () {
                return _.includes(['admin', 'owner', 'member'], this.get('affiliation'));
            },

            isSelf () {
                return this.get('states').includes('110');
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

            async fetchMembers () {
                const new_members = await this.chatroom.getJidsWithAffiliations(['member', 'owner', 'admin']);
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
            defaults: function () {
                return {
                    'muc_domain': _converse.muc_domain,
                    'nick': _converse.getDefaultMUCNickname()
                }
            },

            setDomain (jid) {
                if (!_converse.locked_muc_domain) {
                    this.save('muc_domain', Strophe.getDomainFromJid(jid));
                }
            }
        });


        /**
         * A direct MUC invitation to join a groupchat has been received
         * See XEP-0249: Direct MUC invitations.
         * @private
         * @method _converse.ChatRoom#onDirectMUCInvitation
         * @param { XMLElement } message - The message stanza containing the invitation.
         */
        _converse.onDirectMUCInvitation = function (message) {
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
                const chatroom = openChatRoom(room_jid, {'password': x_el.getAttribute('password') });

                if (chatroom.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED) {
                    // XXX: Leaky abstraction from views here
                    if (_converse.chatboxviews) {
                        _converse.chatboxviews.get(room_jid).join();
                    } else {
                        _converse.chatboxes.get(room_jid).join();
                    }
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
            _converse.api.listen.on('connected', registerDirectInvitationHandler);
            _converse.api.listen.on('reconnected', registerDirectInvitationHandler);
        }

        const getChatRoom = function (jid, attrs, create) {
            jid = jid.toLowerCase();
            attrs.type = _converse.CHATROOMS_TYPE;
            attrs.id = jid;
            return _converse.chatboxes.getChatBox(jid, attrs, create);
        };

        const createChatRoom = function (jid, attrs) {
            if (jid.startsWith('xmpp:') && jid.endsWith('?join')) {
                jid = jid.replace(/^xmpp:/, '').replace(/\?join$/, '');
            }
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
            /**
             * Triggered once any rooms that have been configured to be automatically joined,
             * specified via the _`auto_join_rooms` setting, have been entered.
             * @event _converse#roomsAutoJoined
             * @example _converse.api.listen.on('roomsAutoJoined', () => { ... });
             * @example _converse.api.waitUntil('roomsAutoJoined').then(() => { ... });
             */
            _converse.api.trigger('roomsAutoJoined');
        }

        function disconnectChatRooms () {
            /* When disconnecting, mark all groupchats as
             * disconnected, so that they will be properly entered again
             * when fetched from session storage.
             */
            _converse.chatboxes.each(function (model) {
                if (model.get('type') === _converse.CHATROOMS_TYPE) {
                    model.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                }
            });
        }

        function fetchRegistrationForm (room_jid, user_jid) {
            _converse.api.sendIQ(
                $iq({
                    'from': user_jid,
                    'to': room_jid,
                    'type': 'get'
                }).c('query', {'xmlns': Strophe.NS.REGISTER})
            ).then(iq => {

            }).catch(iq => {
                if (sizzle('item-not-found[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', iq).length) {
                    this.feedback.set('error', __('Error: the groupchat %1$s does not exist.', this.model.getDisplayName()));
                } else if (sizzle('not-allowed[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]').length) {
                    this.feedback.set('error', __("Sorry, you're not allowed to register in this groupchat"));
                }
            });
        }


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('addClientFeatures', () => {
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
        Object.assign(_converse.api, {
            /**
             * The "rooms" namespace groups methods relevant to chatrooms
             * (aka groupchats).
             *
             * @namespace _converse.api.rooms
             * @memberOf _converse.api
             */
            'rooms': {
                /**
                 * Creates a new MUC chatroom (aka groupchat)
                 *
                 * Similar to {@link _converse.api.rooms.open}, but creates
                 * the chatroom in the background (i.e. doesn't cause a view to open).
                 *
                 * @method _converse.api.rooms.create
                 * @param {(string[]|string)} jid|jids The JID or array of
                 *     JIDs of the chatroom(s) to create
                 * @param {object} [attrs] attrs The room attributes
                 */
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

                /**
                 * Opens a MUC chatroom (aka groupchat)
                 *
                 * Similar to {@link _converse.api.chats.open}, but for groupchats.
                 *
                 * @method _converse.api.rooms.open
                 * @param {string} jid The room JID or JIDs (if not specified, all
                 *     currently open rooms will be returned).
                 * @param {string} attrs A map  containing any extra room attributes.
                 * @param {string} [attrs.nick] The current user's nickname for the MUC
                 * @param {boolean} [attrs.auto_configure] A boolean, indicating
                 *     whether the room should be configured automatically or not.
                 *     If set to `true`, then it makes sense to pass in configuration settings.
                 * @param {object} [attrs.roomconfig] A map of configuration settings to be used when the room gets
                 *     configured automatically. Currently it doesn't make sense to specify
                 *     `roomconfig` values if `auto_configure` is set to `false`.
                 *     For a list of configuration values that can be passed in, refer to these values
                 *     in the [XEP-0045 MUC specification](https://xmpp.org/extensions/xep-0045.html#registrar-formtype-owner).
                 *     The values should be named without the `muc#roomconfig_` prefix.
                 * @param {boolean} [attrs.maximize] A boolean, indicating whether minimized rooms should also be
                 *     maximized, when opened. Set to `false` by default.
                 * @param {boolean} [attrs.bring_to_foreground] A boolean indicating whether the room should be
                 *     brought to the foreground and therefore replace the currently shown chat.
                 *     If there is no chat currently open, then this option is ineffective.
                 * @param {Boolean} [force=false] - By default, a minimized
                 *   room won't be maximized (in `overlayed` view mode) and in
                 *   `fullscreen` view mode a newly opened room won't replace
                 *   another chat already in the foreground.
                 *   Set `force` to `true` if you want to force the room to be
                 *   maximized or shown.
                 *
                 * @example
                 * this._converse.api.rooms.open('group@muc.example.com')
                 *
                 * @example
                 * // To return an array of rooms, provide an array of room JIDs:
                 * _converse.api.rooms.open(['group1@muc.example.com', 'group2@muc.example.com'])
                 *
                 * @example
                 * // To setup a custom nickname when joining the room, provide the optional nick argument:
                 * _converse.api.rooms.open('group@muc.example.com', {'nick': 'mycustomnick'})
                 *
                 * @example
                 * // For example, opening a room with a specific default configuration:
                 * _converse.api.rooms.open(
                 *     'myroom@conference.example.org',
                 *     { 'nick': 'coolguy69',
                 *       'auto_configure': true,
                 *       'roomconfig': {
                 *           'changesubject': false,
                 *           'membersonly': true,
                 *           'persistentroom': true,
                 *           'publicroom': true,
                 *           'roomdesc': 'Comfy room for hanging out',
                 *           'whois': 'anyone'
                 *       }
                 *     },
                 *     true
                 * );
                 */
                'open': async function (jids, attrs, force=false) {
                    await _converse.api.waitUntil('chatBoxesFetched');
                    if (_.isUndefined(jids)) {
                        const err_msg = 'rooms.open: You need to provide at least one JID';
                        _converse.log(err_msg, Strophe.LogLevel.ERROR);
                        throw(new TypeError(err_msg));
                    } else if (_.isString(jids)) {
                        return _converse.api.rooms.create(jids, attrs).maybeShow(force);
                    } else {
                        return _.map(jids, jid => _converse.api.rooms.create(jid, attrs).maybeShow(force));
                    }
                },

                /**
                 * Returns an object representing a MUC chatroom (aka groupchat)
                 *
                 * @method _converse.api.rooms.get
                 * @param {string} [jid] The room JID (if not specified, all rooms will be returned).
                 * @param {object} attrs A map containing any extra room attributes For example, if you want
                 *     to specify the nickname, use `{'nick': 'bloodninja'}`. Previously (before
                 *     version 1.0.7, the second parameter only accepted the nickname (as a string
                 *     value). This is currently still accepted, but then you can't pass in any
                 *     other room attributes. If the nickname is not specified then the node part of
                 *     the user's JID will be used.
                 * @param {boolean} create A boolean indicating whether the room should be created
                 *     if not found (default: `false`)
                 * @example
                 * _converse.api.waitUntil('roomsAutoJoined').then(() => {
                 *     const create_if_not_found = true;
                 *     _converse.api.rooms.get(
                 *         'group@muc.example.com',
                 *         {'nick': 'dread-pirate-roberts'},
                 *         create_if_not_found
                 *     )
                 * });
                 */
                'get' (jids, attrs, create) {
                    if (_.isString(attrs)) {
                        attrs = {'nick': attrs};
                    } else if (_.isUndefined(attrs)) {
                        attrs = {};
                    }
                    if (_.isUndefined(jids)) {
                        const result = [];
                        _converse.chatboxes.each(function (chatbox) {
                            if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
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
