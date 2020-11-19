/**
 * @module converse-muc
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Implements the non-view logic for XEP-0045 Multi-User Chat
 */
import "./converse-chat";
import "./converse-disco";
import "./converse-emoji";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from '@converse/skeletor/src/model.js';
import { debounce, intersection, invoke, isElement, isObject, pick, zipObject } from "lodash-es";
import { _converse, api, converse } from "./converse-core";
import log from "./log";
import muc_utils from "./utils/muc";
import st from "./utils/stanza";
import u from "./utils/form";
import p from "./utils/parse-helpers";

export const ROLES = ['moderator', 'participant', 'visitor'];
export const AFFILIATIONS = ['owner', 'admin', 'member', 'outcast', 'none'];

converse.MUC_TRAFFIC_STATES = ['entered', 'exited'];
converse.MUC_ROLE_CHANGES = ['op', 'deop', 'voice', 'mute'];

const ACTION_INFO_CODES = ['301', '303', '333', '307', '321', '322'];

const MUC_ROLE_WEIGHTS = {
    'moderator':    1,
    'participant':  2,
    'visitor':      3,
    'none':         2,
};

const { Strophe, $iq, $build, $msg, $pres, sizzle } = converse.env;

// Add Strophe Namespaces
Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");
Strophe.addNamespace('MUC_HATS', "xmpp:prosody.im/protocol/hats:1");

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
    ENTERED: 5,
    DESTROYED: 6
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
    dependencies: ["converse-chatboxes", "converse-chat", "converse-disco", "converse-controlbox"],

    overrides: {
        ChatBoxes: {
            model (attrs, options) {
                const { _converse } = this.__super__;
                if (attrs && attrs.type == _converse.CHATROOMS_TYPE) {
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
        const { __, ___ } = _converse;

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            'allow_muc': true,
            'allow_muc_invitations': true,
            'auto_join_on_invite': false,
            'auto_join_rooms': [],
            'auto_register_muc_nickname': false,
            'hide_muc_participants': false,
            'locked_muc_domain': false,
            'muc_domain': undefined,
            'muc_fetch_members': true,
            'muc_history_max_stanzas': undefined,
            'muc_instant_rooms': true,
            'muc_nickname_from_jid': false,
            'muc_send_probes': false,
            'muc_show_join_leave': true,
            'muc_show_logs_before_join': false
        });
        api.promises.add(['roomsAutoJoined']);

        if (api.settings.get('locked_muc_domain') && (typeof api.settings.get('muc_domain') !== 'string')) {
            throw new Error("Config Error: it makes no sense to set locked_muc_domain "+
                            "to true when muc_domain is not set");
        }


        /* https://xmpp.org/extensions/xep-0045.html
         * ----------------------------------------
         * 100 message      Entering a groupchat         Inform user that any occupant is allowed to see the user's full JID
         * 101 message (out of band)                     Affiliation change  Inform user that his or her affiliation changed while not in the groupchat
         * 102 message      Configuration change         Inform occupants that groupchat now shows unavailable members
         * 103 message      Configuration change         Inform occupants that groupchat now does not show unavailable members
         * 104 message      Configuration change         Inform occupants that a non-privacy-related groupchat configuration change has occurred
         * 110 presence     Any groupchat presence       Inform user that presence refers to one of its own groupchat occupants
         * 170 message or initial presence               Configuration change    Inform occupants that groupchat logging is now enabled
         * 171 message      Configuration change         Inform occupants that groupchat logging is now disabled
         * 172 message      Configuration change         Inform occupants that the groupchat is now non-anonymous
         * 173 message      Configuration change         Inform occupants that the groupchat is now semi-anonymous
         * 174 message      Configuration change         Inform occupants that the groupchat is now fully-anonymous
         * 201 presence     Entering a groupchat         Inform user that a new groupchat has been created
         * 210 presence     Entering a groupchat         Inform user that the service has assigned or modified the occupant's roomnick
         * 301 presence     Removal from groupchat       Inform user that he or she has been banned from the groupchat
         * 303 presence     Exiting a groupchat          Inform all occupants of new groupchat nickname
         * 307 presence     Removal from groupchat       Inform user that he or she has been kicked from the groupchat
         * 321 presence     Removal from groupchat       Inform user that he or she is being removed from the groupchat because of an affiliation change
         * 322 presence     Removal from groupchat       Inform user that he or she is being removed from the groupchat because the groupchat has been changed to members-only and the user is not a member
         * 332 presence     Removal from groupchat       Inform user that he or she is being removed from the groupchat because of a system shutdown
         */
        _converse.muc = {
            info_messages: {
                100: __('This groupchat is not anonymous'),
                102: __('This groupchat now shows unavailable members'),
                103: __('This groupchat does not show unavailable members'),
                104: __('The groupchat configuration has changed'),
                170: __('Groupchat logging is now enabled'),
                171: __('Groupchat logging is now disabled'),
                172: __('This groupchat is now no longer anonymous'),
                173: __('This groupchat is now semi-anonymous'),
                174: __('This groupchat is now fully-anonymous'),
                201: __('A new groupchat has been created')
            },

            new_nickname_messages: {
                // XXX: Note the triple underscore function and not double underscore.
                210: ___('Your nickname has been automatically set to %1$s'),
                303: ___('Your nickname has been changed to %1$s')
            },

            disconnect_messages: {
                301: __('You have been banned from this groupchat'),
                333: __('You have exited this groupchat due to a technical problem'),
                307: __('You have been kicked from this groupchat'),
                321: __("You have been removed from this groupchat because of an affiliation change"),
                322: __("You have been removed from this groupchat because the groupchat has changed to members-only and you're not a member"),
                332: __("You have been removed from this groupchat because the service hosting it is being shut down")
            },

        }


        async function openRoom (jid) {
            if (!u.isValidMUCJID(jid)) {
                return log.warn(`invalid jid "${jid}" provided in url fragment`);
            }
            await api.waitUntil('roomsAutoJoined');
            if (api.settings.get('allow_bookmarks')) {
                await api.waitUntil('bookmarksInitialized');
            }
            api.rooms.open(jid);
        }
        _converse.router.route('converse/room?jid=:jid', openRoom);


        _converse.getDefaultMUCNickname = function () {
            // XXX: if anything changes here, update the docs for the
            // locked_muc_nickname setting.
            if (!_converse.xmppstatus) {
                throw new Error(
                    "Can't call _converse.getDefaultMUCNickname before the statusInitialized has been fired.");
            }
            const nick = _converse.xmppstatus.getNickname();
            if (nick) {
                return nick;
            } else if (api.settings.get('muc_nickname_from_jid')) {
                return Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.bare_jid));
            }
        }

        async function openChatRoom (jid, settings) {
            /* Opens a groupchat, making sure that certain attributes
             * are correct, for example that the "type" is set to
             * "chatroom".
             */
            settings.type = _converse.CHATROOMS_TYPE;
            settings.id = jid;
            const chatbox = await api.rooms.get(jid, settings, true);
            chatbox.maybeShow(true);
            return chatbox;
        }


        /**
         * Represents a MUC message
         * @class
         * @namespace _converse.ChatRoomMessage
         * @memberOf _converse
         */
        _converse.ChatRoomMessage = _converse.Message.extend({

            initialize () {
                if (!this.checkValidity()) { return; }
                if (this.get('file')) {
                    this.on('change:put', this.uploadFile, this);
                }
                if (!this.setTimerForEphemeralMessage()) {
                    this.setOccupant();
                }
                /**
                 * Triggered once a {@link _converse.ChatRoomMessageInitialized} has been created and initialized.
                 * @event _converse#chatRoomMessageInitialized
                 * @type { _converse.ChatRoomMessages}
                 * @example _converse.api.listen.on('chatRoomMessageInitialized', model => { ... });
                 */
                api.trigger('chatRoomMessageInitialized', this);
            },

            /**
             * Determines whether this messsage may be moderated,
             * based on configuration settings and server support.
             * @async
             * @private
             * @method _converse.ChatRoomMessages#mayBeModerated
             * @returns { Boolean }
             */
            mayBeModerated () {
                return ['all', 'moderator'].includes(api.settings.get('allow_message_retraction')) &&
                    this.collection.chatbox.canModerateMessages();
            },

            checkValidity () {
                const result = _converse.Message.prototype.checkValidity.call(this);
                !result && this.collection.chatbox.debouncedRejoin();
                return result;
            },

            onOccupantRemoved () {
                this.stopListening(this.occupant);
                delete this.occupant;
                const chatbox = this?.collection?.chatbox;
                if (!chatbox) {
                    return log.error(`Could not get collection.chatbox for message: ${JSON.stringify(this.toJSON())}`);
                }
                this.listenTo(chatbox.occupants, 'add', this.onOccupantAdded);
            },

            onOccupantAdded (occupant) {
                if (occupant.get('nick') === Strophe.getResourceFromJid(this.get('from'))) {
                    this.occupant = occupant;
                    this.trigger('occupantAdded');
                    this.listenTo(this.occupant, 'destroy', this.onOccupantRemoved);
                    const chatbox = this?.collection?.chatbox;
                    if (!chatbox) {
                        return log.error(`Could not get collection.chatbox for message: ${JSON.stringify(this.toJSON())}`);
                    }
                    this.stopListening(chatbox.occupants, 'add', this.onOccupantAdded);
                }
            },

            setOccupant () {
                if (this.get('type') !== 'groupchat') { return; }
                const chatbox = this?.collection?.chatbox;
                if (!chatbox) {
                    return log.error(`Could not get collection.chatbox for message: ${JSON.stringify(this.toJSON())}`);
                }
                const nick = Strophe.getResourceFromJid(this.get('from'));
                this.occupant = chatbox.occupants.findWhere({ nick });

                if (!this.occupant && api.settings.get("muc_send_probes")) {
                    this.occupant = chatbox.occupants.create({ nick, 'type': 'unavailable' });
                    const jid = `${chatbox.get('jid')}/${nick}`;
                    api.user.presence.send('probe', jid);
                }

                if (this.occupant) {
                    this.listenTo(this.occupant, 'destroy', this.onOccupantRemoved);
                } else {
                    this.listenTo(chatbox.occupants, 'add', this.onOccupantAdded);
                }
            }
        });


        const MUCSession = Model.extend({
            defaults () {
                return {
                    'connection_status': converse.ROOMSTATUS.DISCONNECTED
                }
            }
        });


        /**
         * Collection which stores MUC messages
         * @class
         * @namespace _converse.ChatRoomMessages
         * @memberOf _converse
         */
        _converse.ChatRoomMessages = Collection.extend({
            model: _converse.ChatRoomMessage,
            comparator: 'time'
        });


        /**
         * Represents an open/ongoing groupchat conversation.
         * @class
         * @namespace _converse.ChatRoom
         * @memberOf _converse
         */
        _converse.ChatRoom = _converse.ChatBox.extend({
            messagesCollection: _converse.ChatRoomMessages,

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
                    'bookmarked': false,
                    'chat_state': undefined,
                    'hidden': _converse.isUniView() && !api.settings.get('singleton'),
                    'hidden_occupants': !!api.settings.get('hide_muc_participants'),
                    'message_type': 'groupchat',
                    'name': '',
                    'num_unread': 0,
                    'roomconfig': {},
                    'time_opened': this.get('time_opened') || (new Date()).getTime(),
                    'time_sent': (new Date(0)).toISOString(),
                    'type': _converse.CHATROOMS_TYPE
                }
            },

            async initialize () {
                this.initialized = u.getResolveablePromise();
                this.debouncedRejoin = debounce(this.rejoin, 250);
                this.set('box_id', `box-${this.get('jid')}`);
                this.initNotifications();
                this.initMessages();
                this.initOccupants();
                this.initDiscoModels(); // sendChatState depends on this.features
                this.registerHandlers();

                this.on('change:chat_state', this.sendChatState, this);
                await this.restoreSession();
                this.session.on('change:connection_status', this.onConnectionStatusChanged, this);

                this.listenTo(this.occupants, 'add', this.onOccupantAdded);
                this.listenTo(this.occupants, 'remove', this.onOccupantRemoved);
                this.listenTo(this.occupants, 'change:show', this.onOccupantShowChanged);
                this.listenTo(this.occupants, 'change:affiliation', this.createAffiliationChangeMessage);
                this.listenTo(this.occupants, 'change:role', this.createRoleChangeMessage);

                const restored = await this.restoreFromCache()
                if (!restored) {
                    this.join();
                }
                /**
                 * Triggered once a {@link _converse.ChatRoom} has been created and initialized.
                 * @event _converse#chatRoomInitialized
                 * @type { _converse.ChatRoom }
                 * @example _converse.api.listen.on('chatRoomInitialized', model => { ... });
                 */
                await api.trigger('chatRoomInitialized', this, {'Synchronous': true});
                this.initialized.resolve();
            },

            /**
             * Checks whether we're still joined and if so, restores the MUC state from cache.
             * @private
             * @method _converse.ChatRoom#restoreFromCache
             * @returns { Boolean } Returns `true` if we're still joined, otherwise returns `false`.
             */
            async restoreFromCache () {
                if (this.session.get('connection_status') === converse.ROOMSTATUS.ENTERED && (await this.isJoined())) {
                    // We've restored the room from cache and we're still joined.
                    await new Promise(resolve => this.features.fetch({'success': resolve, 'error': resolve}));
                    await this.fetchOccupants().catch(e => log.error(e));
                    await this.fetchMessages().catch(e => log.error(e));
                    return true;
                } else {
                    await this.clearCache();
                    return false;
                }
            },

            /**
             * Join the MUC
             * @private
             * @method _converse.ChatRoom#join
             * @param { String } nick - The user's nickname
             * @param { String } [password] - Optional password, if required by the groupchat.
             *  Will fall back to the `password` value stored in the room
             *  model (if available).
             */
            async join (nick, password) {
                if (this.session.get('connection_status') === converse.ROOMSTATUS.ENTERED) {
                    // We have restored a groupchat from session storage,
                    // so we don't send out a presence stanza again.
                    return this;
                }
                await this.refreshDiscoInfo();
                nick = await this.getAndPersistNickname(nick);
                if (!nick) {
                    u.safeSave(this.session, {'connection_status': converse.ROOMSTATUS.NICKNAME_REQUIRED});
                    if (api.settings.get('muc_show_logs_before_join')) {
                        await this.fetchMessages();
                    }
                    return this;
                }
                const stanza = $pres({
                    'from': _converse.connection.jid,
                    'to': this.getRoomJIDAndNick()
                }).c("x", {'xmlns': Strophe.NS.MUC})
                  .c("history", {'maxstanzas': this.features.get('mam_enabled') ? 0 : api.settings.get('muc_history_max_stanzas')}).up();

                password = password || this.get('password');
                if (password) {
                    stanza.cnode(Strophe.xmlElement("password", [], password));
                }
                this.session.save('connection_status', converse.ROOMSTATUS.CONNECTING);
                api.send(stanza);
                return this;
            },

            async clearCache () {
                this.session.save('connection_status', converse.ROOMSTATUS.DISCONNECTED);
                if (this.occupants.length) {
                    // Remove non-members when reconnecting
                    this.occupants.filter(o => !o.isMember()).forEach(o => o.destroy());
                } else {
                    // Looks like we haven't restored occupants from cache, so we clear it.
                    this.occupants.clearStore();
                }
                if (api.settings.get('clear_messages_on_reconnection')) {
                    await this.clearMessages();
                }
            },

            onOccupantAdded (occupant) {
                if (api.settings.get('muc_show_join_leave') &&
                        this.session.get('connection_status') ===  converse.ROOMSTATUS.ENTERED &&
                        occupant.get('show') === 'online') {
                    this.updateNotifications(occupant.get('nick'), 'entered');
                }
            },

            onOccupantRemoved (occupant) {
                if (api.settings.get('muc_show_join_leave') &&
                        this.session.get('connection_status') ===  converse.ROOMSTATUS.ENTERED &&
                        occupant.get('show') === 'online') {
                    this.updateNotifications(occupant.get('nick'), 'exited');
                }
            },

            onOccupantShowChanged (occupant) {
                if (occupant.get('states').includes('303') || !api.settings.get('muc_show_join_leave')) {
                    return;
                }
                if (occupant.get('show') === 'offline') {
                    this.updateNotifications(occupant.get('nick'), 'exited');
                } else if (occupant.get('show') === 'online') {
                    this.updateNotifications(occupant.get('nick'), 'entered');
                }
            },

            /**
             * Clear stale cache and re-join a MUC we've been in before.
             * @private
             * @method _converse.ChatRoom#rejoin
             */
            rejoin () {
                this.clearCache();
                return this.join();
            },

            async onConnectionStatusChanged () {
                if (this.session.get('connection_status') === converse.ROOMSTATUS.ENTERED) {
                    await this.occupants.fetchMembers();
                    await this.fetchMessages();
                    /**
                     * Triggered when the user has entered a new MUC
                     * @event _converse#enteredNewRoom
                     * @type { _converse.ChatRoom}
                     * @example _converse.api.listen.on('enteredNewRoom', model => { ... });
                     */
                    api.trigger('enteredNewRoom', this);

                    if (api.settings.get('auto_register_muc_nickname') &&
                            await api.disco.supports(Strophe.NS.MUC_REGISTER, this.get('jid'))) {
                        this.registerNickname()
                    }
                }
            },

            async onReconnection () {
                this.registerHandlers();
                await this.rejoin();
                this.announceReconnection();
            },

            restoreSession () {
                const id = `muc.session-${_converse.bare_jid}-${this.get('jid')}`;
                this.session = new MUCSession({id});
                this.session.browserStorage = _converse.createStore(id, "session");
                return new Promise(r => this.session.fetch({'success': r, 'error': r}));
            },

            initDiscoModels () {
                let id = `converse.muc-features-${_converse.bare_jid}-${this.get('jid')}`;
                this.features = new Model(
                    Object.assign({id}, zipObject(converse.ROOM_FEATURES, converse.ROOM_FEATURES.map(() => false)))
                );
                this.features.browserStorage = _converse.createStore(id, "session");

                id = `converse.muc-config-{_converse.bare_jid}-${this.get('jid')}`;
                this.config = new Model();
                this.config.browserStorage = _converse.createStore(id, "session");
            },

            initOccupants () {
                this.occupants = new _converse.ChatRoomOccupants();
                const id = `converse.occupants-${_converse.bare_jid}${this.get('jid')}`;
                this.occupants.browserStorage = _converse.createStore(id, 'session');
                this.occupants.chatroom = this;
            },

            fetchOccupants () {
                this.occupants.fetched = new Promise(resolve => {
                    this.occupants.fetch({
                        'add': true,
                        'silent': true,
                        'success': resolve,
                        'error': resolve
                    });
                });
                return this.occupants.fetched;
            },

            handleAffiliationChangedMessage (stanza) {
                const item = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"] item`, stanza).pop();
                if (item) {
                    const from = stanza.getAttribute("from");
                    const type = stanza.getAttribute("type");
                    const affiliation = item.getAttribute('affiliation');
                    const jid = item.getAttribute('jid');
                    const data = {
                        from, type, affiliation,
                        'nick': Strophe.getNodeFromJid(jid),
                        'states': [],
                        'show': type == 'unavailable' ? 'offline' : 'online',
                        'role': item.getAttribute('role'),
                        'jid': Strophe.getBareJidFromJid(jid),
                        'resource': Strophe.getResourceFromJid(jid)
                    }
                    const occupant = this.occupants.findOccupant({'jid': data.jid});
                    if (occupant) {
                        occupant.save(data);
                    } else {
                        this.occupants.create(data);
                    }
                }
            },

            async handleErrorMessageStanza (stanza) {
                const attrs = await st.parseMUCMessage(stanza, this, _converse);
                if (!await this.shouldShowErrorMessage(attrs)) {
                    return;
                }
                const message = this.getMessageReferencedByError(attrs);
                if (message) {
                    const new_attrs = {
                        'error': attrs.error,
                        'error_condition': attrs.error_condition,
                        'error_text': attrs.error_text,
                        'error_type': attrs.error_type,
                        'editable': false,
                    };
                    if (attrs.msgid === message.get('retraction_id')) {
                        // The error message refers to a retraction
                        new_attrs.retraction_id = undefined;
                        if (!attrs.error) {
                            if (attrs.error_condition === 'forbidden') {
                                new_attrs.error = __("You're not allowed to retract your message.");
                            } else if (attrs.error_condition === 'not-acceptable') {
                                new_attrs.error = __("Your retraction was not delivered because you're not present in the groupchat.");
                            } else {
                                new_attrs.error = __('Sorry, an error occurred while trying to retract your message.');
                            }
                        }
                    } else if (!attrs.error) {
                        if (attrs.error_condition === 'forbidden') {
                            new_attrs.error = __("Your message was not delivered because you weren't allowed to send it.");
                        } else if (attrs.error_condition === 'not-acceptable') {
                            new_attrs.error = __("Your message was not delivered because you're not present in the groupchat.");
                        } else {
                            new_attrs.error = __('Sorry, an error occurred while trying to send your message.');
                        }
                    }
                    message.save(new_attrs);
                } else {
                    this.createMessage(attrs);
                }
            },

            /**
             * Parses an incoming message stanza and queues it for processing.
             * @private
             * @method _converse.ChatRoom#handleMessageStanza
             * @param { XMLElement } stanza
             */
            async handleMessageStanza (stanza) {
                if (st.isArchived(stanza)) {
                    // MAM messages are handled in converse-mam.
                    // We shouldn't get MAM messages here because
                    // they shouldn't have a `type` attribute.
                    return log.warn(`Received a MAM message with type "groupchat"`);
                }
                this.createInfoMessages(stanza);
                this.fetchFeaturesIfConfigurationChanged(stanza);

                /**
                 * @typedef { Object } MUCMessageData
                 * An object containing the original groupchat message stanza,
                 * as well as the parsed attributes.
                 * @property { XMLElement } stanza
                 * @property { MUCMessageAttributes } attrs
                 * @property { ChatRoom } chatbox
                 */
                const attrs = await st.parseMUCMessage(stanza, this, _converse);
                const data = {stanza, attrs, 'chatbox': this};
                /**
                 * Triggered when a groupchat message stanza has been received and parsed.
                 * @event _converse#message
                 * @type { object }
                 * @property { module:converse-muc~MUCMessageData } data
                 */
                api.trigger('message', data);
                return attrs && this.queueMessage(attrs);
            },

            registerHandlers () {
                // Register presence and message handlers for this groupchat
                const room_jid = this.get('jid');
                this.removeHandlers();
                this.presence_handler = _converse.connection.addHandler(
                    stanza => (this.onPresence(stanza) || true),
                    null, 'presence', null, null, room_jid,
                    {'ignoreNamespaceFragment': true, 'matchBareFromJid': true}
                );

                this.message_handler = _converse.connection.addHandler(
                    stanza => (!!this.handleMessageStanza(stanza) || true),
                    null, 'message', 'groupchat', null, room_jid,
                    {'matchBareFromJid': true}
                );

                this.affiliation_message_handler = _converse.connection.addHandler(
                    stanza => (this.handleAffiliationChangedMessage(stanza) || true),
                    Strophe.NS.MUC_USER, 'message', null, null, room_jid
                );
            },

            removeHandlers () {
                // Remove the presence and message handlers that were
                // registered for this groupchat.
                if (this.message_handler) {
                    _converse.connection && _converse.connection.deleteHandler(this.message_handler);
                    delete this.message_handler;
                }
                if (this.presence_handler) {
                    _converse.connection && _converse.connection.deleteHandler(this.presence_handler);
                    delete this.presence_handler;
                }
                if (this.affiliation_message_handler) {
                    _converse.connection && _converse.connection.deleteHandler(this.affiliation_message_handler);
                    delete this.affiliation_message_handler;
                }
                return this;
            },

            invitesAllowed () {
                return api.settings.get('allow_muc_invitations') &&
                    (this.features.get('open') ||
                        this.getOwnAffiliation() === "owner"
                    );
            },

            getDisplayName () {
                const name = this.get('name');
                if (name) {
                    return name;
                } else if (api.settings.get('locked_muc_domain') === 'hidden') {
                    return Strophe.getNodeFromJid(this.get('jid'));
                } else {
                    return this.get('jid');
                }
            },

            /**
             * Sends a message stanza to the XMPP server and expects a reflection
             * or error message within a specific timeout period.
             * @private
             * @method _converse.ChatRoom#sendTimedMessage
             * @param { _converse.Message|XMLElement } message
             * @returns { Promise<XMLElement>|Promise<_converse.TimeoutError> } Returns a promise
             *  which resolves with the reflected message stanza or rejects
             *  with an error stanza or with a {@link _converse.TimeoutError}.
             */
            sendTimedMessage (el) {
                if (typeof(el.tree) === "function") {
                    el = el.tree();
                }
                let id = el.getAttribute('id');
                if (!id) { // inject id if not found
                    id = this.getUniqueId("sendIQ");
                    el.setAttribute("id", id);
                }
                const promise = u.getResolveablePromise();
                const timeoutHandler = _converse.connection.addTimedHandler(
                    _converse.STANZA_TIMEOUT,
                    () => {
                        _converse.connection.deleteHandler(handler);
                        promise.reject(new _converse.TimeoutError("Timeout Error: No response from server"));
                        return false;
                    }
                );
                const handler = _converse.connection.addHandler(stanza => {
                    timeoutHandler && _converse.connection.deleteTimedHandler(timeoutHandler);
                    if (stanza.getAttribute('type') === 'groupchat') {
                        promise.resolve(stanza);
                    } else {
                        promise.reject(stanza);
                    }
                }, null, 'message', ['error', 'groupchat'], id);
                api.send(el)
                return promise;
            },

            /**
             * Retract one of your messages in this groupchat
             * @private
             * @method _converse.ChatRoom#retractOwnMessage
             * @param { _converse.Message } message - The message which we're retracting.
             */
            async retractOwnMessage(message) {
                const origin_id = message.get('origin_id');
                if (!origin_id) {
                    throw new Error("Can't retract message without a XEP-0359 Origin ID");
                }
                const editable = message.get('editable');
                const stanza = $msg({
                        'id': u.getUniqueId(),
                        'to': this.get('jid'),
                        'type': "groupchat"
                    })
                    .c('store', {xmlns: Strophe.NS.HINTS}).up()
                    .c("apply-to", {
                        'id': origin_id,
                        'xmlns': Strophe.NS.FASTEN
                    }).c('retract', {xmlns: Strophe.NS.RETRACT});

                // Optimistic save
                message.set({
                    'retracted': (new Date()).toISOString(),
                    'retracted_id': origin_id,
                    'retraction_id': stanza.nodeTree.getAttribute('id'),
                    'editable': false
                });
                try {
                    await this.sendTimedMessage(stanza);
                } catch (e) {
                    message.save({
                        editable,
                        'error_type': 'timeout',
                        'error': __('A timeout happened while while trying to retract your message.'),
                        'retracted': undefined,
                        'retracted_id': undefined
                    });
                    throw e;
                }
            },

            /**
             * Retract someone else's message in this groupchat.
             * @private
             * @method _converse.ChatRoom#retractOtherMessage
             * @param { _converse.Message } message - The message which we're retracting.
             * @param { string } [reason] - The reason for retracting the message.
             */
            async retractOtherMessage (message, reason) {
                const editable = message.get('editable');
                // Optimistic save
                message.save({
                    'moderated': 'retracted',
                    'moderated_by': _converse.bare_jid,
                    'moderated_id': message.get('msgid'),
                    'moderation_reason': reason,
                    'editable': false
                });
                const result = await this.sendRetractionIQ(message, reason);
                if (result === null || u.isErrorStanza(result)) {
                    // Undo the save if something went wrong
                    message.save({
                        editable,
                        'moderated': undefined,
                        'moderated_by': undefined,
                        'moderated_id': undefined,
                        'moderation_reason': undefined,
                    });
                }
                return result;
            },

            /**
             * Sends an IQ stanza to the XMPP server to retract a message in this groupchat.
             * @private
             * @method _converse.ChatRoom#sendRetractionIQ
             * @param { _converse.Message } message - The message which we're retracting.
             * @param { string } [reason] - The reason for retracting the message.
             */
            sendRetractionIQ (message, reason) {
                const iq = $iq({'to': this.get('jid'), 'type': "set"})
                    .c("apply-to", {
                        'id': message.get(`stanza_id ${this.get('jid')}`),
                        'xmlns': Strophe.NS.FASTEN
                    }).c('moderate', {xmlns: Strophe.NS.MODERATE})
                        .c('retract', {xmlns: Strophe.NS.RETRACT}).up()
                        .c('reason').t(reason || '');
                return api.sendIQ(iq, null, false);
            },

            /**
             * Sends an IQ stanza to the XMPP server to destroy this groupchat. Not
             * to be confused with the {@link _converse.ChatRoom#destroy}
             * method, which simply removes the room from the local browser storage cache.
             * @private
             * @method _converse.ChatRoom#sendDestroyIQ
             * @param { string } [reason] - The reason for destroying the groupchat.
             * @param { string } [new_jid] - The JID of the new groupchat which replaces this one.
             */
            sendDestroyIQ (reason, new_jid) {
                const destroy = $build("destroy");
                if (new_jid) {
                    destroy.attrs({'jid': new_jid});
                }
                const iq = $iq({
                    'to': this.get('jid'),
                    'type': "set"
                }).c("query", {'xmlns': Strophe.NS.MUC_OWNER}).cnode(destroy.node);
                if (reason && reason.length > 0) {
                    iq.c("reason", reason);
                }
                return api.sendIQ(iq);
            },

            /**
             * Leave the groupchat.
             * @private
             * @method _converse.ChatRoom#leave
             * @param { string } [exit_msg] - Message to indicate your reason for leaving
             */
            async leave (exit_msg) {
                this.features.destroy();
                this.occupants.clearStore();
                if (_converse.disco_entities) {
                    const disco_entity = _converse.disco_entities.get(this.get('jid'));
                    if (disco_entity) {
                        await new Promise((success, error) => disco_entity.destroy({success, error}));
                    }
                }
                if (api.connection.connected()) {
                    api.user.presence.send('unavailable', this.getRoomJIDAndNick(), exit_msg);
                }
                u.safeSave(this.session, {'connection_status': converse.ROOMSTATUS.DISCONNECTED});
                this.removeHandlers();
            },

            async close () {
                // Delete the session model
                await new Promise(resolve => this.session.destroy({
                    'success': resolve,
                    'error': (m, e) => { log.error(e); resolve() }
                }));
                // Delete the features model
                await new Promise(resolve => this.features.destroy({
                    'success': resolve,
                    'error': (m, e) => { log.error(e); resolve() }
                }));
                return _converse.ChatBox.prototype.close.call(this);
            },

            canModerateMessages () {
                const self = this.getOwnOccupant();
                return self && self.isModerator() && api.disco.supports(Strophe.NS.MODERATE, this.get('jid'));
            },

            /**
             * Return an array of unique nicknames based on all occupants and messages in this MUC.
             * @private
             * @method _converse.ChatRoom#getAllKnownNicknames
             * @returns { String[] }
             */
            getAllKnownNicknames () {
                return [...new Set([
                    ...this.occupants.map(o => o.get('nick')),
                    ...this.messages.map(m => m.get('nick'))
                ])].filter(n => n);
            },

            getAllKnownNicknamesRegex () {
                const longNickString = this.getAllKnownNicknames().join('|');
                const escapedLongNickString = p.escapeRegexString(longNickString)
                return RegExp(`(?:\\s|^)@(${escapedLongNickString})(?![\\w@-])`, 'ig');
            },

            getOccupantByJID (jid) {
                return this.occupants.findOccupant({ jid });
            },

            getOccupantByNickname (nick) {
                return this.occupants.findOccupant({ nick });
            },

            parseTextForReferences (original_message) {
                if (!original_message) return ['', []];
                const findRegexInMessage = p.matchRegexInText(original_message);
                const raw_mentions = findRegexInMessage(p.mention_regex);
                if (!raw_mentions) return [original_message, []];

                const known_nicknames = this.getAllKnownNicknames();
                const getMatchingNickname = p.findFirstMatchInArray(known_nicknames);

                const uriFromNickname = nickname => {
                    const jid = this.get('jid');
                    const occupant  = this.getOccupant(nickname) || this.getOccupant(jid);
                    const uri = (occupant && occupant.get('jid')) || `${jid}/${nickname}`;
                    return encodeURI(`xmpp:${uri}`);
                };

                const matchToReference = match => {
                    const at_sign_index = match[0].indexOf('@');
                    const begin = match.index + at_sign_index;
                    const end = begin + match[0].length - at_sign_index;
                    const value = getMatchingNickname(match[1]);
                    const type = 'mention';
                    const uri = uriFromNickname(value);
                    return { begin, end, value, type, uri }
                }

                const mentions = [...findRegexInMessage(this.getAllKnownNicknamesRegex())];
                const references = mentions.map(matchToReference);

                const [updated_message, updated_references] = p.reduceTextFromReferences(
                    original_message,
                    references
                );
                return [updated_message, updated_references];
            },

            getOutgoingMessageAttributes (original_message, spoiler_hint) {
                const is_spoiler = this.get('composing_spoiler');
                const [text, references] = this.parseTextForReferences(original_message);
                const origin_id = u.getUniqueId();
                const body = text ? u.httpToGeoUri(u.shortnamesToUnicode(text), _converse) : undefined;
                return {
                    body,
                    is_spoiler,
                    origin_id,
                    references,
                    'id': origin_id,
                    'msgid': origin_id,
                    'from': `${this.get('jid')}/${this.get('nick')}`,
                    'fullname': this.get('nick'),
                    'is_only_emojis': text ? u.isOnlyEmojis(text) : false,
                    'message': body,
                    'nick': this.get('nick'),
                    'sender': 'me',
                    'spoiler_hint': is_spoiler ? spoiler_hint : undefined,
                    'type': 'groupchat'
                };
            },

            /**
             * Utility method to construct the JID for the current user as occupant of the groupchat.
             * @private
             * @method _converse.ChatRoom#getRoomJIDAndNick
             * @returns {string} - The groupchat JID with the user's nickname added at the end.
             * @example groupchat@conference.example.org/nickname
             */
            getRoomJIDAndNick () {
                const nick = this.get('nick');
                const jid = Strophe.getBareJidFromJid(this.get('jid'));
                return jid + (nick !== null ? `/${nick}` : "");
            },

            /**
             * Sends a message with the current XEP-0085 chat state of the user
             * as taken from the `chat_state` attribute of the {@link _converse.ChatRoom}.
             * @private
             * @method _converse.ChatRoom#sendChatState
             */
            sendChatState () {
                if (!api.settings.get('send_chat_state_notifications') ||
                        !this.get('chat_state') ||
                        this.session.get('connection_status') !== converse.ROOMSTATUS.ENTERED ||
                        this.features.get('moderated') && this.getOwnRole() === 'visitor') {
                    return;
                }
                const allowed = api.settings.get('send_chat_state_notifications');
                if (Array.isArray(allowed) && !allowed.includes(this.get('chat_state'))) {
                    return;
                }
                const chat_state = this.get('chat_state');
                if (chat_state === _converse.GONE) {
                    // <gone/> is not applicable within MUC context
                    return;
                }
                api.send(
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
             * @param { String } [reason] - Reason for the invitation
             */
            directInvite (recipient, reason) {
                if (this.features.get('membersonly')) {
                    // When inviting to a members-only groupchat, we first add
                    // the person to the member list by giving them an
                    // affiliation of 'member' otherwise they won't be able to join.
                    this.updateMemberLists([{'jid': recipient, 'affiliation': 'member', 'reason': reason}]);
                }
                const attrs = {
                    'xmlns': 'jabber:x:conference',
                    'jid': this.get('jid')
                };
                if (reason !== null) { attrs.reason = reason; }
                if (this.get('password')) {
                    attrs.password = this.get('password');
                }
                const invitation = $msg({
                    'from': _converse.connection.jid,
                    'to': recipient,
                    'id': u.getUniqueId()
                }).c('x', attrs);
                api.send(invitation);
                /**
                 * After the user has sent out a direct invitation (as per XEP-0249),
                 * to a roster contact, asking them to join a room.
                 * @event _converse#chatBoxMaximized
                 * @type {object}
                 * @property {_converse.ChatRoom} room
                 * @property {string} recipient - The JID of the person being invited
                 * @property {string} reason - The original reason for the invitation
                 * @example _converse.api.listen.on('chatBoxMaximized', view => { ... });
                 */
                api.trigger('roomInviteSent', {
                    'room': this,
                    'recipient': recipient,
                    'reason': reason
                });
            },

            /**
             * Refresh the disco identity, features and fields for this {@link _converse.ChatRoom}.
             * *features* are stored on the features {@link Model} attribute on this {@link _converse.ChatRoom}.
             * *fields* are stored on the config {@link Model} attribute on this {@link _converse.ChatRoom}.
             * @private
             * @returns {Promise}
             */
            refreshDiscoInfo () {
                return api.disco.refresh(this.get('jid'))
                    .then(() => this.getDiscoInfo())
                    .catch(e => log.error(e));
            },

            /**
             * Fetch the *extended* MUC info from the server and cache it locally
             * https://xmpp.org/extensions/xep-0045.html#disco-roominfo
             * @private
             * @method _converse.ChatRoom#getDiscoInfo
             * @returns {Promise}
             */
            getDiscoInfo () {
                return api.disco.getIdentity('conference', 'text', this.get('jid'))
                    .then(identity => this.save({'name': identity?.get('name')}))
                    .then(() => this.getDiscoInfoFields())
                    .then(() => this.getDiscoInfoFeatures())
                    .catch(e => log.error(e));
            },

            /**
             * Fetch the *extended* MUC info fields from the server and store them locally
             * in the `config` {@link Model} attribute.
             * See: https://xmpp.org/extensions/xep-0045.html#disco-roominfo
             * @private
             * @method _converse.ChatRoom#getDiscoInfoFields
             * @returns {Promise}
             */
            async getDiscoInfoFields () {
                const fields = await api.disco.getFields(this.get('jid'));
                const config = fields.reduce((config, f) => {
                    const name = f.get('var');
                    if (name && name.startsWith('muc#roominfo_')) {
                        config[name.replace('muc#roominfo_', '')] = f.get('value');
                    }
                    return config;
                }, {});
                this.config.save(config);
            },

            /**
             * Use converse-disco to populate the features {@link Model} which
             * is stored as an attibute on this {@link _converse.ChatRoom}.
             * The results may be cached. If you want to force fetching the features from the
             * server, call {@link _converse.ChatRoom#refreshDiscoInfo} instead.
             * @private
             * @returns {Promise}
             */
            async getDiscoInfoFeatures () {
                const features = await api.disco.getFeatures(this.get('jid'));
                const attrs = Object.assign(
                    zipObject(converse.ROOM_FEATURES, converse.ROOM_FEATURES.map(() => false)),
                    {'fetched': (new Date()).toISOString()}
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
             * @returns { Promise } A promise which resolves and fails depending on the XMPP server response.
             */
            setAffiliation (affiliation, members) {
                members = members.filter(m => m.affiliation === undefined || m.affiliation === affiliation);
                return Promise.all(members.map(m => this.sendAffiliationIQ(affiliation, m)));
            },

            /**
             * Given a <field> element, return a copy with a <value> child if
             * we can find a value for it in this rooms config.
             * @private
             * @method _converse.ChatRoom#addFieldValue
             * @returns { Element }
             */
            addFieldValue (field) {
                const type = field.getAttribute('type');
                if (type === 'fixed') {
                    return field;
                }
                const fieldname = field.getAttribute('var').replace('muc#roomconfig_', '');
                const config = this.get('roomconfig');
                if (fieldname in config) {
                    let values;
                    switch (type) {
                        case 'boolean':
                            values = [config[fieldname] ? 1 : 0];
                            break;
                        case 'list-multi':
                            values = config[fieldname];
                            break;
                        default:
                            values= [config[fieldname]];
                    }
                    field.innerHTML = values.map(v => $build('value').t(v)).join('');
                }
                return field;
            },

            /**
             * Automatically configure the groupchat based on this model's
             * 'roomconfig' data.
             * @private
             * @method _converse.ChatRoom#autoConfigureChatRoom
             * @returns { Promise<XMLElement> }
             * Returns a promise which resolves once a response IQ has
             * been received.
             */
            async autoConfigureChatRoom () {
                const stanza = await this.fetchRoomConfiguration();
                const fields = sizzle('field', stanza);
                const configArray = fields.map(f => this.addFieldValue(f))
                if (configArray.length) {
                    return this.sendConfiguration(configArray);
                }
            },

            /**
             * Send an IQ stanza to fetch the groupchat configuration data.
             * Returns a promise which resolves once the response IQ
             * has been received.
             * @private
             * @method _converse.ChatRoom#fetchRoomConfiguration
             * @returns { Promise<XMLElement> }
             */
            fetchRoomConfiguration () {
                return api.sendIQ(
                    $iq({'to': this.get('jid'), 'type': "get"})
                     .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                );
            },

            /**
             * Sends an IQ stanza with the groupchat configuration.
             * @private
             * @method _converse.ChatRoom#sendConfiguration
             * @param { Array } config - The groupchat configuration
             * @returns { Promise<XMLElement> } - A promise which resolves with
             * the `result` stanza received from the XMPP server.
             */
            sendConfiguration (config=[]) {
                const iq = $iq({to: this.get('jid'), type: "set"})
                    .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                    .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                config.forEach(node => iq.cnode(node).up());
                return api.sendIQ(iq);
            },

            /**
             * Returns the `role` which the current user has in this MUC
             * @private
             * @method _converse.ChatRoom#getOwnRole
             * @returns { ('none'|'visitor'|'participant'|'moderator') }
             */
            getOwnRole () {
                return this.getOwnOccupant()?.attributes?.role;
            },

            /**
             * Returns the `affiliation` which the current user has in this MUC
             * @private
             * @method _converse.ChatRoom#getOwnAffiliation
             * @returns { ('none'|'outcast'|'member'|'admin'|'owner') }
             */
            getOwnAffiliation () {
                return this.getOwnOccupant()?.attributes?.affiliation;
            },

            /**
             * Get the {@link _converse.ChatRoomOccupant} instance which
             * represents the current user.
             * @private
             * @method _converse.ChatRoom#getOwnOccupant
             * @returns { _converse.ChatRoomOccupant }
             */
            getOwnOccupant () {
                return this.occupants.findWhere({'jid': _converse.bare_jid});
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
                if (member.reason !== undefined) {
                    iq.c("reason", member.reason);
                }
                return api.sendIQ(iq);
            },

            /**
             * Send IQ stanzas to the server to modify affiliations for users in this groupchat.
             *
             * See: https://xmpp.org/extensions/xep-0045.html#modifymember
             * @private
             * @method _converse.ChatRoom#setAffiliations
             * @param { Object[] } members
             * @param { string } members[].jid - The JID of the user whose affiliation will change
             * @param { Array } members[].affiliation - The new affiliation for this user
             * @param { string } [members[].reason] - An optional reason for the affiliation change
             * @returns { Promise }
             */
            setAffiliations (members) {
                const affiliations = [...new Set(members.map(m => m.affiliation))];
                return Promise.all(affiliations.map(a => this.setAffiliation(a, members)));
            },

            /**
             * Send an IQ stanza to modify an occupant's role
             * @private
             * @method _converse.ChatRoom#setRole
             * @param { _converse.ChatRoomOccupant } occupant
             * @param { String } role
             * @param { String } reason
             * @param { function } onSuccess - callback for a succesful response
             * @param { function } onError - callback for an error response
             */
            setRole (occupant, role, reason, onSuccess, onError) {
                const item = $build("item", {
                    'nick': occupant.get('nick'),
                    role
                });
                const iq = $iq({
                    'to': this.get('jid'),
                    'type': 'set'
                }).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                if (reason !== null) {
                    iq.c("reason", reason);
                }
                return api.sendIQ(iq).then(onSuccess).catch(onError);
            },

            /**
             * @private
             * @method _converse.ChatRoom#getOccupant
             * @param { String } nickname_or_jid - The nickname or JID of the occupant to be returned
             * @returns { _converse.ChatRoomOccupant }
             */
            getOccupant (nickname_or_jid) {
                return u.isValidJID(nickname_or_jid)
                    ? this.getOccupantByJID(nickname_or_jid)
                    : this.getOccupantByNickname(nickname_or_jid);
            },

            /**
             * Return an array of occupant models that have the required role
             * @private
             * @method _converse.ChatRoom#getOccupantsWithRole
             * @param { String } role
             * @returns { _converse.ChatRoomOccupant[] }
             */
            getOccupantsWithRole (role) {
                return this.getOccupantsSortedBy('nick')
                    .filter(o => o.get('role') === role)
                    .map(item => {
                        return {
                            'jid': item.get('jid'),
                            'nick': item.get('nick'),
                            'role': item.get('role')
                        }
                    });
            },

            /**
             * Return an array of occupant models that have the required affiliation
             * @private
             * @method _converse.ChatRoom#getOccupantsWithAffiliation
             * @param { String } affiliation
             * @returns { _converse.ChatRoomOccupant[] }
             */
            getOccupantsWithAffiliation (affiliation) {
                return this.getOccupantsSortedBy('nick')
                    .filter(o => o.get('affiliation') === affiliation)
                    .map(item => {
                        return {
                            'jid': item.get('jid'),
                            'nick': item.get('nick'),
                            'affiliation': item.get('affiliation')
                        }
                    });
            },

            /**
             * Return an array of occupant models, sorted according to the passed-in attribute.
             * @private
             * @method _converse.ChatRoom#getOccupantsSortedBy
             * @param { String } attr - The attribute to sort the returned array by
             * @returns { _converse.ChatRoomOccupant[] }
             */
            getOccupantsSortedBy (attr) {
                return Array.from(this.occupants.models)
                    .sort((a, b) => a.get(attr) < b.get(attr) ? -1 : (a.get(attr) > b.get(attr) ? 1 : 0));
            },

            /**
             * Sends an IQ stanza to the server, asking it for the relevant affiliation list .
             * Returns an array of {@link MemberListItem} objects, representing occupants
             * that have the given affiliation.
             * See: https://xmpp.org/extensions/xep-0045.html#modifymember
             * @private
             * @method _converse.ChatRoom#getAffiliationList
             * @param { ("admin"|"owner"|"member") } affiliation
             * @returns { Promise<MemberListItem[]> }
             */
            async getAffiliationList (affiliation) {
                const iq = $iq({to: this.get('jid'), type: "get"})
                    .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                        .c("item", {'affiliation': affiliation});
                const result = await api.sendIQ(iq, null, false);
                if (result === null) {
                    const err_msg = `Error: timeout while fetching ${affiliation} list for MUC ${this.get('jid')}`;
                    const err = new Error(err_msg);
                    log.warn(err_msg);
                    log.warn(result);
                    return err;
                }
                if (u.isErrorStanza(result)) {
                    const err_msg = `Error: not allowed to fetch ${affiliation} list for MUC ${this.get('jid')}`;
                    const err = new Error(err_msg);
                    log.warn(err_msg);
                    log.warn(result);
                    return err;
                }
                return muc_utils.parseMemberListIQ(result)
                    .filter(p => p)
                    .sort((a, b) => a.nick < b.nick ? -1 : (a.nick > b.nick ? 1 : 0))
            },

            /**
             * Fetch the lists of users with the given affiliations.
             * Then compute the delta between those users and
             * the passed in members, and if it exists, send the delta
             * to the XMPP server to update the member list.
             * @private
             * @method _converse.ChatRoom#updateMemberLists
             * @param { object } members - Map of member jids and affiliations.
             * @returns { Promise }
             *  A promise which is resolved once the list has been
             *  updated or once it's been established there's no need
             *  to update the list.
             */
            async updateMemberLists (members) {
                const all_affiliations = ['member', 'admin', 'owner'];
                const aff_lists = await Promise.all(all_affiliations.map(a => this.getAffiliationList(a)));
                const old_members = aff_lists.reduce((acc, val) => (u.isErrorObject(val) ? acc: [...val, ...acc]), []);
                await this.setAffiliations(muc_utils.computeAffiliationsDelta(true, false, members, old_members));
                await this.occupants.fetchMembers();
            },

            /**
             * Given a nick name, save it to the model state, otherwise, look
             * for a server-side reserved nickname or default configured
             * nickname and if found, persist that to the model state.
             * @private
             * @method _converse.ChatRoom#getAndPersistNickname
             * @returns { Promise<string> } A promise which resolves with the nickname
             */
            async getAndPersistNickname (nick) {
                nick = nick ||
                    this.get('nick') ||
                    await this.getReservedNick() ||
                    _converse.getDefaultMUCNickname();

                if (nick) {
                    this.save({nick}, {'silent': true});
                }
                return nick;
            },

            /**
             * Use service-discovery to ask the XMPP server whether
             * this user has a reserved nickname for this groupchat.
             * If so, we'll use that, otherwise we render the nickname form.
             * @private
             * @method _converse.ChatRoom#getReservedNick
             * @returns { Promise<string> } A promise which resolves with the reserved nick or null
             */
            async getReservedNick () {
                const stanza = $iq({
                    'to': this.get('jid'),
                    'from': _converse.connection.jid,
                    'type': "get"
                }).c("query", {
                    'xmlns': Strophe.NS.DISCO_INFO,
                    'node': 'x-roomuser-item'
                })
                const result = await api.sendIQ(stanza, null, false);
                if (u.isErrorObject(result)) {
                    throw result;
                }
                const identity_el = result.querySelector('query[node="x-roomuser-item"] identity');
                return identity_el ? identity_el.getAttribute('name') : null;
            },

            async registerNickname () {
                // See https://xmpp.org/extensions/xep-0045.html#register
                const nick = this.get('nick');
                const jid = this.get('jid');
                let iq, err_msg;
                try {
                    iq = await api.sendIQ(
                        $iq({
                            'to': jid,
                            'from': _converse.connection.jid,
                            'type': 'get'
                        }).c('query', {'xmlns': Strophe.NS.MUC_REGISTER})
                    );
                } catch (e) {
                    if (sizzle(`not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                        err_msg = __("You're not allowed to register yourself in this groupchat.");
                    } else if (sizzle(`registration-required[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                        err_msg = __("You're not allowed to register in this groupchat because it's members-only.");
                    }
                    log.error(e);
                    return err_msg;
                }
                const required_fields = sizzle('field required', iq).map(f => f.parentElement);
                if (required_fields.length > 1 && required_fields[0].getAttribute('var') !== 'muc#register_roomnick') {
                    return log.error(`Can't register the user register in the groupchat ${jid} due to the required fields`);
                }
                try {
                    await api.sendIQ($iq({
                            'to': jid,
                            'from': _converse.connection.jid,
                            'type': 'set'
                        }).c('query', {'xmlns': Strophe.NS.MUC_REGISTER})
                            .c('x', {'xmlns': Strophe.NS.XFORM, 'type': 'submit'})
                                .c('field', {'var': 'FORM_TYPE'}).c('value').t('http://jabber.org/protocol/muc#register').up().up()
                                .c('field', {'var': 'muc#register_roomnick'}).c('value').t(nick)
                    );
                } catch (e) {
                    if (sizzle(`service-unavailable[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                        err_msg = __("Can't register your nickname in this groupchat, it doesn't support registration.");
                    } else if (sizzle(`bad-request[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                        err_msg = __("Can't register your nickname in this groupchat, invalid data form supplied.");
                    }
                    log.error(err_msg);
                    log.error(e);
                    return err_msg;
                }
            },

            /**
             * Given a presence stanza, update the occupant model based on its contents.
             * @private
             * @method _converse.ChatRoom#updateOccupantsOnPresence
             * @param { XMLElement } pres - The presence stanza
             */
            updateOccupantsOnPresence (pres) {
                const data = st.parseMUCPresence(pres);
                if (data.type === 'error' || (!data.jid && !data.nick)) {
                    return true;
                }
                const occupant = this.occupants.findOccupant(data);
                // Destroy an unavailable occupant if this isn't a nick change operation and if they're not affiliated
                if (data.type === 'unavailable' && occupant &&
                        !data.states.includes(converse.MUC_NICK_CHANGED_CODE) &&
                        !['admin', 'owner', 'member'].includes(data['affiliation'])) {
                    // Before destroying we set the new data, so that we can show the disconnection message
                    occupant.set(data);
                    occupant.destroy();
                    return;
                }
                const jid = data.jid || '';
                const attributes = Object.assign(data, {
                    'jid': Strophe.getBareJidFromJid(jid) || occupant?.attributes?.jid,
                    'resource': Strophe.getResourceFromJid(jid) || occupant?.attributes?.resource
                });
                if (occupant) {
                    occupant.save(attributes);
                } else {
                    this.occupants.create(attributes);
                }
            },

            fetchFeaturesIfConfigurationChanged (stanza) {
                // 104: configuration change
                // 170: logging enabled
                // 171: logging disabled
                // 172: room no longer anonymous
                // 173: room now semi-anonymous
                // 174: room now fully anonymous
                const codes = ['104', '170', '171', '172', '173', '174'];
                if (sizzle('status', stanza).filter(e => codes.includes(e.getAttribute('status'))).length) {
                    this.refreshDiscoInfo();
                }
            },

            /**
             * Given two JIDs, which can be either user JIDs or MUC occupant JIDs,
             * determine whether they belong to the same user.
             * @private
             * @method _converse.ChatRoom#isSameUser
             * @param { String } jid1
             * @param { String } jid2
             * @returns { Boolean }
             */
            isSameUser (jid1, jid2) {
                const bare_jid1 = Strophe.getBareJidFromJid(jid1);
                const bare_jid2 = Strophe.getBareJidFromJid(jid2);
                const resource1 = Strophe.getResourceFromJid(jid1);
                const resource2 = Strophe.getResourceFromJid(jid2);
                if (u.isSameBareJID(jid1, jid2)) {
                    if (bare_jid1 === this.get('jid')) {
                        // MUC JIDs
                        return resource1 === resource2;
                    } else {
                        return true;
                    }
                } else {
                    const occupant1 = (bare_jid1 === this.get('jid')) ?
                        this.occupants.findOccupant({'nick': resource1}) :
                        this.occupants.findOccupant({'jid': bare_jid1});

                    const occupant2 = (bare_jid2 === this.get('jid')) ?
                        this.occupants.findOccupant({'nick': resource2}) :
                        this.occupants.findOccupant({'jid': bare_jid2});
                    return occupant1 === occupant2;
                }
            },

            async isSubjectHidden () {
                const jids = await api.user.settings.get('mucs_with_hidden_subject', [])
                return jids.includes(this.get('jid'));
            },

            async toggleSubjectHiddenState () {
                const muc_jid = this.get('jid');
                const jids = await api.user.settings.get('mucs_with_hidden_subject', []);
                if (jids.includes(this.get('jid'))) {
                    api.user.settings.set('mucs_with_hidden_subject', jids.filter(jid => jid !== muc_jid));
                } else {
                    api.user.settings.set('mucs_with_hidden_subject', [...jids, muc_jid]);
                }
            },

            /**
             * Handle a possible subject change and return `true` if so.
             * @private
             * @method _converse.ChatRoom#handleSubjectChange
             * @param { object } attrs - Attributes representing a received
             *  message, as returned by {@link st.parseMUCMessage}
             */
            async handleSubjectChange (attrs) {
                if (typeof attrs.subject === 'string' && !attrs.thread && !attrs.message) {
                    // https://xmpp.org/extensions/xep-0045.html#subject-mod
                    // -----------------------------------------------------
                    // The subject is changed by sending a message of type "groupchat" to the <room@service>,
                    // where the <message/> MUST contain a <subject/> element that specifies the new subject but
                    // MUST NOT contain a <body/> element (or a <thread/> element).
                    const subject = attrs.subject;
                    const author = attrs.nick;
                    u.safeSave(this, {'subject': {author, 'text': attrs.subject || ''}});
                    if (!attrs.is_delayed && author) {
                        const message = subject ? __('Topic set by %1$s', author) : __('Topic cleared by %1$s', author);
                        const prev_msg = this.messages.last();
                        if (prev_msg?.get('nick') !== attrs.nick ||
                                prev_msg?.get('type') !== 'info' ||
                                prev_msg?.get('message') !== message) {
                            this.createMessage({message, 'nick': attrs.nick, 'type': 'info'});
                        }
                        if (await this.isSubjectHidden()) {
                            this.toggleSubjectHiddenState();
                        }
                     }
                    return true;
                }
                return false;
            },

            /**
             * Set the subject for this {@link _converse.ChatRoom}
             * @private
             * @method _converse.ChatRoom#setSubject
             * @param { String } value
             */
            setSubject(value='') {
                api.send(
                    $msg({
                        to: this.get('jid'),
                        from: _converse.connection.jid,
                        type: "groupchat"
                    }).c("subject", {xmlns: "jabber:client"}).t(value).tree()
                );
            },

            /**
             * Is this a chat state notification that can be ignored,
             * because it's old or because it's from us.
             * @private
             * @method _converse.ChatRoom#ignorableCSN
             * @param { Object } attrs - The message attributes
             */
            ignorableCSN (attrs) {
                return attrs.chat_state && !attrs.body && (attrs.is_delayed || this.isOwnMessage(attrs));
            },


            /**
             * Determines whether the message is from ourselves by checking
             * the `from` attribute. Doesn't check the `type` attribute.
             * @private
             * @method _converse.ChatRoom#isOwnMessage
             * @param { Object|XMLElement|_converse.Message } msg
             * @returns { boolean }
             */
            isOwnMessage (msg) {
                let from;
                if (isElement(msg)) {
                    from = msg.getAttribute('from');
                } else if (msg instanceof _converse.Message) {
                    from = msg.get('from');
                } else {
                    from = msg.from;
                }
                return Strophe.getResourceFromJid(from) == this.get('nick');
            },


            getUpdatedMessageAttributes (message, attrs) {
                const new_attrs = _converse.ChatBox.prototype.getUpdatedMessageAttributes.call(this, message, attrs);
                if (this.isOwnMessage(attrs)) {
                    const stanza_id_keys = Object.keys(attrs).filter(k => k.startsWith('stanza_id'));
                    Object.assign(new_attrs,  pick(attrs, stanza_id_keys));
                    if (!message.get('received')) {
                        new_attrs.received = (new Date()).toISOString();
                    }
                }
                return new_attrs;
            },

            /**
             * Send a MUC-0410 MUC Self-Ping stanza to room to determine
             * whether we're still joined.
             * @async
             * @private
             * @method _converse.ChatRoom#isJoined
             * @returns {Promise<boolean>}
             */
            async isJoined () {
                const jid = this.get('jid');
                const ping = $iq({
                    'to': `${jid}/${this.get('nick')}`,
                    'type': "get"
                }).c("ping", {'xmlns': Strophe.NS.PING});
                try {
                    await api.sendIQ(ping);
                } catch (e) {
                    if (e === null) {
                        log.warn(`isJoined: Timeout error while checking whether we're joined to MUC: ${jid}`);
                    } else {
                        log.warn(`isJoined: Apparently we're no longer connected to MUC: ${jid}`);
                    }
                    return false;
                }
                return true;
            },

            /**
             * Check whether we're still joined and re-join if not
             * @async
             * @private
             * @method _converse.ChatRoom#rejoinIfNecessary
             */
            async rejoinIfNecessary () {
                if (! await this.isJoined()) {
                    this.rejoin();
                    return true;
                }
            },

            /**
             * @private
             * @method _converse.ChatRoom#shouldShowErrorMessage
             * @returns {Promise<boolean>}
             */
            async shouldShowErrorMessage (attrs) {
                if (attrs['error_condition'] === 'not-acceptable' && await this.rejoinIfNecessary()) {
                    return false;
                }
                return _converse.ChatBox.prototype.shouldShowErrorMessage.call(this, attrs);
            },

            /**
             * Looks whether we already have a moderation message for this
             * incoming message. If so, it's considered "dangling" because
             * it probably hasn't been applied to anything yet, given that
             * the relevant message is only coming in now.
             * @private
             * @method _converse.ChatRoom#findDanglingModeration
             * @param { object } attrs - Attributes representing a received
             *  message, as returned by {@link st.parseMUCMessage}
             * @returns { _converse.ChatRoomMessage }
             */
            findDanglingModeration (attrs) {
                if (!this.messages.length) {
                    return null;
                }
                // Only look for dangling moderation if there are newer
                // messages than this one, since moderation come after.
                if (this.messages.last().get('time') > attrs.time) {
                    // Search from latest backwards
                    const messages = Array.from(this.messages.models);
                    const stanza_id = attrs[`stanza_id ${this.get('jid')}`];
                    if (!stanza_id) {
                        return null;
                    }
                    messages.reverse();
                    return messages.find(
                        ({attributes}) =>
                            attributes.moderated === 'retracted' &&
                            attributes.moderated_id === stanza_id &&
                            attributes.moderated_by
                    );
                }
            },

            /**
             * Handles message moderation based on the passed in attributes.
             * @private
             * @method _converse.ChatRoom#handleModeration
             * @param { object } attrs - Attributes representing a received
             *  message, as returned by {@link st.parseMUCMessage}
             * @returns { Boolean } Returns `true` or `false` depending on
             *  whether a message was moderated or not.
             */
            async handleModeration (attrs) {
                const MODERATION_ATTRIBUTES = [
                    'editable',
                    'moderated',
                    'moderated_by',
                    'moderated_id',
                    'moderation_reason'
                ];
                if (attrs.moderated === 'retracted') {
                    const query = {};
                    const key = `stanza_id ${this.get('jid')}`;
                    query[key] = attrs.moderated_id;
                    const message = this.messages.findWhere(query);
                    if (!message) {
                        attrs['dangling_moderation'] = true;
                        await this.createMessage(attrs);
                        return true;
                    }
                    message.save(pick(attrs, MODERATION_ATTRIBUTES));
                    return true;
                } else {
                    // Check if we have dangling moderation message
                    const message = this.findDanglingModeration(attrs);
                    if (message) {
                        const moderation_attrs = pick(message.attributes, MODERATION_ATTRIBUTES);
                        const new_attrs = Object.assign({'dangling_moderation': false}, attrs, moderation_attrs);
                        delete new_attrs['id']; // Delete id, otherwise a new cache entry gets created
                        message.save(new_attrs);
                        return true;
                    }
                }
                return false;
            },

            /**
             * @param {String} actor - The nickname of the actor that caused the notification
             * @param {String|Array<String>} states - The state or states representing the type of notificcation
             */
            removeNotification (actor, states) {
                const actors_per_state = this.notifications.toJSON();
                states = Array.isArray(states) ? states : [states];
                states.forEach(state => {
                    const existing_actors = Array.from(actors_per_state[state] || []);
                    if (existing_actors.includes(actor)) {
                        const idx = existing_actors.indexOf(actor);
                        existing_actors.splice(idx, 1);
                        this.notifications.set(state, Array.from(existing_actors));
                    }
                });
            },

            /**
             * Update the notifications model by adding the passed in nickname
             * to the array of nicknames that all match a particular state.
             *
             * Removes the nickname from any other states it might be associated with.
             *
             * The state can be a XEP-0085 Chat State or a XEP-0045 join/leave
             * state.
             * @param {String} actor - The nickname of the actor that causes the notification
             * @param {String} state - The state representing the type of notificcation
             */
            updateNotifications (actor, state) {
                const actors_per_state = this.notifications.toJSON();
                const existing_actors = actors_per_state[state] || [];
                if (existing_actors.includes(actor)) {
                    return;
                }
                const reducer = (out, s) => {
                    if (s === state) {
                        out[s] =  [...existing_actors, actor];
                    } else {
                        out[s] = (actors_per_state[s] || []).filter(a => a !== actor);
                    }
                    return out;
                };
                const actors_per_chat_state = converse.CHAT_STATES.reduce(reducer, {});
                const actors_per_traffic_state = converse.MUC_TRAFFIC_STATES.reduce(reducer, {});
                const actors_per_role_change = converse.MUC_ROLE_CHANGES.reduce(reducer, {});
                this.notifications.set(Object.assign(
                    actors_per_chat_state,
                    actors_per_traffic_state,
                    actors_per_role_change
                ));
                window.setTimeout(() => this.removeNotification(actor, state), 10000);
            },

            /**
             * Handler for all MUC messages sent to this groupchat. This method
             * shouldn't be called directly, instead {@link _converse.ChatRoom#queueMessage}
             * should be called.
             * @private
             * @method _converse.ChatRoom#onMessage
             * @param { MessageAttributes } attrs - A promise which resolves to the message attributes.
             */
            async onMessage (attrs) {
                attrs = await attrs;
                if (u.isErrorObject(attrs)) {
                    attrs.stanza && log.error(attrs.stanza);
                    return log.error(attrs.message);
                }
                const message = this.getDuplicateMessage(attrs);
                if (message) {
                    return this.updateMessage(message, attrs);
                } else if (attrs.is_valid_receipt_request || attrs.is_marker || this.ignorableCSN(attrs)) {
                    return;
                }
                if (await this.handleRetraction(attrs) ||
                        await this.handleModeration(attrs) ||
                        await this.handleSubjectChange(attrs)) {
                    return this.removeNotification(attrs.nick, ['composing', 'paused']);
                }
                this.setEditable(attrs, attrs.time);

                if (attrs['chat_state']) {
                    this.updateNotifications(attrs.nick, attrs.chat_state);
                }
                if (u.shouldCreateGroupchatMessage(attrs)) {
                    const msg = this.handleCorrection(attrs) || await this.createMessage(attrs);
                    this.removeNotification(attrs.nick, ['composing', 'paused']);
                    this.handleUnreadMessage(msg);
                }
            },

            handleModifyError(pres) {
                const text = pres.querySelector('error text')?.textContent;
                if (text) {
                    if (this.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING) {
                        this.setDisconnectionMessage(text);
                    } else {
                        const attrs = {
                            'type': 'error',
                            'message': text,
                            'is_ephemeral': true
                        }
                        this.createMessage(attrs);
                    }
                }
            },

            /**
             * Handle a presence stanza that disconnects the user from the MUC
             * @param { XMLElement } stanza
             */
            handleDisconnection (stanza) {
                const is_self = stanza.querySelector("status[code='110']") !== null;
                const x = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"]`, stanza).pop();
                if (!x) {
                    return;
                }
                const codes = sizzle('status', x).map(s => s.getAttribute('code'));
                const disconnection_codes = intersection(codes, Object.keys(_converse.muc.disconnect_messages));
                const disconnected = is_self && disconnection_codes.length > 0;
                if (!disconnected) {
                    return;
                }
                // By using querySelector we assume here there is
                // one <item> per <x xmlns='http://jabber.org/protocol/muc#user'>
                // element. This appears to be a safe assumption, since
                // each <x/> element pertains to a single user.
                const item = x.querySelector('item');
                const reason = item ? item.querySelector('reason')?.textContent : undefined;
                const actor = item ? invoke(item.querySelector('actor'), 'getAttribute', 'nick') : undefined;
                const message = _converse.muc.disconnect_messages[disconnection_codes[0]];
                this.setDisconnectionMessage(message, reason, actor);
            },


            getActionInfoMessage (code, nick, actor) {
                if (code === '301') {
                    return actor ? __("%1$s has been banned by %2$s", nick, actor) : __("%1$s has been banned", nick);
                } else if (code === '303') {
                    return __("%1$s\'s nickname has changed", nick);
                } else  if (code === '307') {
                    return actor ? __("%1$s has been kicked out by %2$s", nick, actor) : __("%1$s has been kicked out", nick);
                } else if (code === '321') {
                    return __("%1$s has been removed because of an affiliation change", nick);
                } else if (code === '322') {
                    return __("%1$s has been removed for not being a member", nick);
                }
            },

            createAffiliationChangeMessage (occupant) {
                const previous_affiliation = occupant._previousAttributes.affiliation;

                if (!previous_affiliation) {
                    // If no previous affiliation was set, then we don't
                    // interpret this as an affiliation change.
                    // For example, if muc_send_probes is true, then occupants
                    // are created based on incoming messages, in which case
                    // we don't yet know the affiliation
                    return
                }

                const current_affiliation = occupant.get('affiliation');
                if (previous_affiliation === 'admin') {
                    this.createMessage({
                        'type': 'info',
                        'message': __("%1$s is no longer an admin of this groupchat", occupant.get('nick'))
                    });
                } else if (previous_affiliation === 'owner') {
                    this.createMessage({
                        'type': 'info',
                        'message': __("%1$s is no longer an owner of this groupchat", occupant.get('nick'))
                    });
                } else if (previous_affiliation === 'outcast') {
                    this.createMessage({
                        'type': 'info',
                        'message': __("%1$s is no longer banned from this groupchat", occupant.get('nick'))
                    });
                }

                if (current_affiliation === 'none' && previous_affiliation === 'member') {
                    this.createMessage({
                        'type': 'info',
                        'message': __("%1$s is no longer a member of this groupchat", occupant.get('nick'))
                    });
                }

                if (current_affiliation === 'member') {
                    this.createMessage({
                        'type': 'info',
                        'message': __("%1$s is now a member of this groupchat", occupant.get('nick'))
                    });
                } else if (current_affiliation === 'admin' || current_affiliation == 'owner') {
                    // For example: AppleJack is now an (admin|owner) of this groupchat
                    this.createMessage({
                        'type': 'info',
                        'message': __(
                            '%1$s is now an %2$s of this groupchat',
                            occupant.get('nick'),
                            current_affiliation
                        )
                    });
                }
            },

            createRoleChangeMessage (occupant, changed) {
                if (changed === "none" || occupant.changed.affiliation) {
                    // We don't inform of role changes if they accompany affiliation changes.
                    return;
                }
                const previous_role = occupant._previousAttributes.role;
                if (previous_role === 'moderator') {
                    this.updateNotifications(occupant.get('nick'), 'deop');
                } else if (previous_role === 'visitor') {
                    this.updateNotifications(occupant.get('nick'), 'voice');
                }
                if (occupant.get('role') === 'visitor') {
                    this.updateNotifications(occupant.get('nick'), 'mute');
                } else if (occupant.get('role') === 'moderator') {
                    if (!['owner', 'admin'].includes(occupant.get('affiliation'))) {
                        // Oly show this message if the user isn't already
                        // an admin or owner, otherwise this isn't new information.
                        this.updateNotifications(occupant.get('nick'), 'op');
                    }
                }
            },


            /**
             * Create an info message based on a received MUC status code
             * @private
             * @method _converse.ChatRoom#createInfoMessage
             * @param { string } code - The MUC status code
             * @param { XMLElement } stanza - The original stanza that contains the code
             * @param { Boolean } is_self - Whether this stanza refers to our own presence
             */
            createInfoMessage (code, stanza, is_self) {
                const data = { 'type': 'info', };

                if (code === '110' || (code === '100' && !is_self)) {
                    return;
                } else if (code in _converse.muc.info_messages) {
                    data.message = _converse.muc.info_messages[code];
                } else if (!is_self && ACTION_INFO_CODES.includes(code)) {
                    const nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                    const item = stanza.querySelector(`x[xmlns="${Strophe.NS.MUC_USER}"] item`);
                    data.actor = item ? item.querySelector('actor')?.getAttribute('nick') : undefined;
                    data.reason = item ? item.querySelector('reason')?.textContent : undefined;
                    data.message = this.getActionInfoMessage(code, nick, data.actor);
                } else if (is_self && (code in _converse.muc.new_nickname_messages)) {
                    // XXX: Side-effect of setting the nick. Should ideally be refactored out of this method
                    let nick;
                    if (is_self && code === "210") {
                        nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                    } else if (is_self && code === "303") {
                        nick = stanza.querySelector(`x[xmlns="${Strophe.NS.MUC_USER}"] item`).getAttribute('nick');
                    }
                    this.save('nick', nick);
                    data.message = __(_converse.muc.new_nickname_messages[code], nick);
                }
                if (data.message) {
                    if (code === "201" && this.messages.findWhere(data)) {
                        return;
                    } else if (code in _converse.muc.info_messages &&
                            this.messages.length &&
                            this.messages.pop().get('message') === data.message) {
                        // XXX: very naive duplication checking
                        return;
                    }
                    this.createMessage(data);
                }
            },


            /**
             * Create info messages based on a received presence or message stanza
             * @private
             * @method _converse.ChatRoom#createInfoMessages
             * @param { XMLElement } stanza
             */
            createInfoMessages (stanza) {
                const codes = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"] status`, stanza).map(s => s.getAttribute('code'));
                if (codes.includes('333') && codes.includes('307')) {
                    // See: https://github.com/xsf/xeps/pull/969/files#diff-ac5113766e59219806793c1f7d967f1bR4966
                    codes.splice(codes.indexOf('307'), 1);
                }
                const is_self = codes.includes('110');
                codes.forEach(code => this.createInfoMessage(code, stanza, is_self));
            },


            setDisconnectionMessage (message, reason, actor) {
                this.save({
                    'disconnection_message': message,
                    'disconnection_reason': reason,
                    'disconnection_actor': actor
                });
                this.session.save({'connection_status': converse.ROOMSTATUS.DISCONNECTED});
            },


            onNicknameClash (presence) {
                if (api.settings.get('muc_nickname_from_jid')) {
                    const nick = presence.getAttribute('from').split('/')[1];
                    if (nick === _converse.getDefaultMUCNickname()) {
                        this.join(nick + '-2');
                    } else {
                        const del= nick.lastIndexOf("-");
                        const num = nick.substring(del+1, nick.length);
                        this.join(nick.substring(0, del+1) + String(Number(num)+1));
                    }
                } else {
                    this.save({
                        'nickname_validation_message': __(
                            "The nickname you chose is reserved or "+
                            "currently in use, please choose a different one."
                        )
                    });
                    this.session.save({'connection_status': converse.ROOMSTATUS.NICKNAME_REQUIRED});
                }
            },


            /**
             * Parses a <presence> stanza with type "error" and sets the proper
             * `connection_status` value for this {@link _converse.ChatRoom} as
             * well as any additional output that can be shown to the user.
             * @private
             * @param { XMLElement } stanza - The presence stanza
             */
            onErrorPresence (stanza) {
                const error = stanza.querySelector('error');
                const error_type = error.getAttribute('type');
                const reason = sizzle(`text[xmlns="${Strophe.NS.STANZAS}"]`, error).pop()?.textContent;

                if (error_type === 'modify') {
                    this.handleModifyError(stanza);
                } else if (error_type === 'auth') {
                    if (sizzle(`not-authorized[xmlns="${Strophe.NS.STANZAS}"]`, error).length) {
                        this.save({'password_validation_message': reason || __("Password incorrect")});
                        this.session.save({'connection_status': converse.ROOMSTATUS.PASSWORD_REQUIRED});
                    }
                    if (error.querySelector('registration-required')) {
                        const message = __('You are not on the member list of this groupchat.');
                        this.setDisconnectionMessage(message, reason);
                    } else if (error.querySelector('forbidden')) {
                        const message = __('You have been banned from this groupchat.');
                        this.setDisconnectionMessage(message, reason);
                    }
                } else if (error_type === 'cancel') {
                    if (error.querySelector('not-allowed')) {
                        const message = __('You are not allowed to create new groupchats.');
                        this.setDisconnectionMessage(message, reason);
                    } else if (error.querySelector('not-acceptable')) {
                        const message = __("Your nickname doesn't conform to this groupchat's policies.");
                        this.setDisconnectionMessage(message, reason);
                    } else if (sizzle(`gone[xmlns="${Strophe.NS.STANZAS}"]`, error).length) {
                        const moved_jid = sizzle(`gone[xmlns="${Strophe.NS.STANZAS}"]`, error).pop()?.textContent
                            .replace(/^xmpp:/, '')
                            .replace(/\?join$/, '');
                        this.save({ moved_jid, 'destroyed_reason': reason});
                        this.session.save({'connection_status': converse.ROOMSTATUS.DESTROYED});
                    } else if (error.querySelector('conflict')) {
                        this.onNicknameClash(stanza);
                    } else if (error.querySelector('item-not-found')) {
                        const message = __("This groupchat does not (yet) exist.");
                        this.setDisconnectionMessage(message, reason);
                    } else if (error.querySelector('service-unavailable')) {
                        const message = __("This groupchat has reached its maximum number of participants.");
                        this.setDisconnectionMessage(message, reason);
                    } else if (error.querySelector('remote-server-not-found')) {
                        const message = __("Remote server not found");
                        const feedback = reason ? __('The explanation given is: "%1$s".', reason) : undefined;
                        this.setDisconnectionMessage(message, feedback);
                    }
                }
            },


            /**
             * Handles all MUC presence stanzas.
             * @private
             * @method _converse.ChatRoom#onPresence
             * @param { XMLElement } stanza
             */
            onPresence (stanza) {
                if (stanza.getAttribute('type') === 'error') {
                    return this.onErrorPresence(stanza);
                }
                this.createInfoMessages(stanza);
                if (stanza.querySelector("status[code='110']")) {
                    this.onOwnPresence(stanza);
                    if (this.getOwnRole() !== 'none' &&
                            this.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING) {
                        this.session.save('connection_status', converse.ROOMSTATUS.CONNECTED);
                    }
                } else {
                    this.updateOccupantsOnPresence(stanza);
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
            onOwnPresence (stanza) {
                if (stanza.getAttribute('type') !== 'unavailable') {
                    const old_status = this.session.get('connection_status');
                    if (old_status !== converse.ROOMSTATUS.ENTERED) {
                        // Set connection_status before creating the occupant, but
                        // only trigger afterwards, so that plugins can access the
                        // occupant in their event handlers.
                        this.session.save('connection_status', converse.ROOMSTATUS.ENTERED, {'silent': true});
                        this.updateOccupantsOnPresence(stanza);
                        this.session.trigger('change:connection_status', this.session, old_status);
                    } else {
                        this.updateOccupantsOnPresence(stanza);
                    }
                } else {
                    this.updateOccupantsOnPresence(stanza);
                }

                if (stanza.getAttribute('type') === 'unavailable') {
                    this.handleDisconnection(stanza);
                } else {
                    const locked_room = stanza.querySelector("status[code='201']");
                    if (locked_room) {
                        if (this.get('auto_configure')) {
                            this.autoConfigureChatRoom().then(() => this.refreshDiscoInfo());
                        } else if (api.settings.get('muc_instant_rooms')) {
                            // Accept default configuration
                            this.sendConfiguration().then(() => this.refreshDiscoInfo());
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
                        if (this.getOwnAffiliation() === 'owner' && this.get('auto_configure')) {
                            this.autoConfigureChatRoom().then(() => this.refreshDiscoInfo());
                        } else {
                            this.getDiscoInfo();
                        }
                    }
                }
                this.session.save({'connection_status': converse.ROOMSTATUS.ENTERED});
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
                    return mentions.includes(nick);
                } else {
                    return (new RegExp(`\\b${nick}\\b`)).test(message.get('message'));
                }
            },

            /* Given a newly received message, update the unread counter if necessary.
             * @private
             * @method _converse.ChatRoom#handleUnreadMessage
             * @param { XMLElement } - The <messsage> stanza
             */
            handleUnreadMessage (message) {
                if (!message?.get('body')) {
                    return
                }
                if (u.isNewMessage(message)) {
                    if (this.isHidden()) {
                        const settings = {
                            'num_unread_general': this.get('num_unread_general') + 1
                        };
                        if (this.get('num_unread_general') === 0) {
                            settings['first_unread_id'] = message.get('id');
                        }
                        if (this.isUserMentioned(message)) {
                            settings.num_unread = this.get('num_unread') + 1;
                        }
                        this.save(settings);
                    } else {
                        this.sendMarkerForMessage(message);
                    }
                }
            },

            clearUnreadMsgCounter() {
                if (this.get('num_unread_general') > 0 || this.get('num_unread') > 0) {
                    this.sendMarkerForMessage(this.messages.last());
                }
                u.safeSave(this, {
                    'num_unread': 0,
                    'num_unread_general': 0
                });
            }
        });


        /**
         * Represents a participant in a MUC
         * @class
         * @namespace _converse.ChatRoomOccupant
         * @memberOf _converse
         */
        _converse.ChatRoomOccupant = Model.extend({

            defaults: {
                'hats': [],
                'show': 'offline',
                'states': []
            },

            initialize (attributes) {
                this.set(Object.assign({'id': u.getUniqueId()}, attributes));
                this.on('change:image_hash', this.onAvatarChanged, this);
            },

            onAvatarChanged () {
                const hash = this.get('image_hash');
                const vcards = [];
                if (this.get('jid')) {
                    vcards.push(_converse.vcards.findWhere({'jid': this.get('jid')}));
                }
                vcards.push(_converse.vcards.findWhere({'jid': this.get('from')}));

                vcards.filter(v => v).forEach(vcard => {
                    if (hash && vcard.get('image_hash') !== hash) {
                        api.vcard.update(vcard, true);
                    }
                });
            },

            getDisplayName () {
                return this.get('nick') || this.get('jid');
            },

            isMember () {
                return ['admin', 'owner', 'member'].includes(this.get('affiliation'));
            },

            isModerator () {
                return ['admin', 'owner'].includes(this.get('affiliation')) || this.get('role') === 'moderator';
            },

            isSelf () {
                return this.get('states').includes('110');
            }
        });


        /**
         * A list of {@link _converse.ChatRoomOccupant} instances, representing participants in a MUC.
         * @class
         * @namespace _converse.ChatRoomOccupants
         * @memberOf _converse
         */
        _converse.ChatRoomOccupants = Collection.extend({
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

            getAutoFetchedAffiliationLists () {
                const affs = api.settings.get('muc_fetch_members');
                return Array.isArray(affs) ? affs :  (affs ? ['member', 'admin', 'owner'] : []);
            },

            async fetchMembers () {
                const affiliations = this.getAutoFetchedAffiliationLists();
                if (affiliations.length === 0) {
                    return;
                }
                const aff_lists = await Promise.all(affiliations.map(a => this.chatroom.getAffiliationList(a)));
                const new_members = aff_lists.reduce((acc, val) => (u.isErrorObject(val) ? acc : [...val, ...acc]), []);
                const known_affiliations = affiliations.filter(a => !u.isErrorObject(aff_lists[affiliations.indexOf(a)]));
                const new_jids = new_members.map(m => m.jid).filter(m => m !== undefined);
                const new_nicks = new_members.map(m => !m.jid && m.nick || undefined).filter(m => m !== undefined);
                const removed_members = this.filter(m => {
                        return known_affiliations.includes(m.get('affiliation')) &&
                            !new_nicks.includes(m.get('nick')) &&
                            !new_jids.includes(m.get('jid'));
                    });

                removed_members.forEach(occupant => {
                    if (occupant.get('jid') === _converse.bare_jid) { return; }
                    if (occupant.get('show') === 'offline') {
                        occupant.destroy();
                    } else {
                        occupant.save('affiliation', null);
                    }
                });
                new_members.forEach(attrs => {
                    const occupant = attrs.jid ?
                        this.findOccupant({'jid': attrs.jid}) :
                        this.findOccupant({'nick': attrs.nick});
                    if (occupant) {
                        occupant.save(attrs);
                    } else {
                        this.create(attrs);
                    }
                });
                /**
                 * Triggered once the member lists for this MUC have been fetched and processed.
                 * @event _converse#membersFetched
                 * @example _converse.api.listen.on('membersFetched', () => { ... });
                 */
                api.trigger('membersFetched');
            },

            /**
             * @typedef { Object} OccupantData
             * @property { String } [jid]
             * @property { String } [nick]
             */
            /**
             * Try to find an existing occupant based on the passed in
             * data object.
             *
             * If we have a JID, we use that as lookup variable,
             * otherwise we use the nick. We don't always have both,
             * but should have at least one or the other.
             * @private
             * @method _converse.ChatRoomOccupants#findOccupant
             * @param { OccupantData } data
             */
            findOccupant (data) {
                const jid = Strophe.getBareJidFromJid(data.jid);
                return (jid && this.findWhere({ jid })) || this.findWhere({'nick': data.nick});
            }
        });


        _converse.RoomsPanelModel = Model.extend({
            defaults: function () {
                return {
                    'muc_domain': api.settings.get('muc_domain'),
                    'nick': _converse.getDefaultMUCNickname()
                }
            },

            setDomain (jid) {
                if (!api.settings.get('locked_muc_domain')) {
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
        _converse.onDirectMUCInvitation = async function (message) {
            const x_el = sizzle('x[xmlns="jabber:x:conference"]', message).pop(),
                from = Strophe.getBareJidFromJid(message.getAttribute('from')),
                room_jid = x_el.getAttribute('jid'),
                reason = x_el.getAttribute('reason');

            let result;
            if (api.settings.get('auto_join_on_invite')) {
                result = true;
            } else {
                // Invite request might come from someone not your roster list
                let contact = _converse.roster.get(from);
                contact = contact ? contact.getDisplayName(): from;
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
                const chatroom = await openChatRoom(room_jid, {'password': x_el.getAttribute('password') });
                if (chatroom.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED) {
                    _converse.chatboxes.get(room_jid).rejoin();
                }
            }
        };

        if (api.settings.get('allow_muc_invitations')) {
            const registerDirectInvitationHandler = function () {
                _converse.connection.addHandler(
                    (message) =>  {
                        _converse.onDirectMUCInvitation(message);
                        return true;
                    }, 'jabber:x:conference', 'message');
            };
            api.listen.on('connected', registerDirectInvitationHandler);
            api.listen.on('reconnected', registerDirectInvitationHandler);
        }

        /* Automatically join groupchats, based on the
         * "auto_join_rooms" configuration setting, which is an array
         * of strings (groupchat JIDs) or objects (with groupchat JID and other settings).
         */
        async function autoJoinRooms () {
            await Promise.all(api.settings.get('auto_join_rooms').map(muc => {
                if (typeof muc === 'string') {
                    if (_converse.chatboxes.where({'jid': muc}).length) {
                        return Promise.resolve();
                    }
                    return api.rooms.open(muc);
                } else if (isObject(muc)) {
                    return api.rooms.open(muc.jid, {...muc});
                } else {
                    log.error('Invalid muc criteria specified for "auto_join_rooms"');
                    return Promise.resolve();
                }
            }));
            /**
             * Triggered once any rooms that have been configured to be automatically joined,
             * specified via the _`auto_join_rooms` setting, have been entered.
             * @event _converse#roomsAutoJoined
             * @example _converse.api.listen.on('roomsAutoJoined', () => { ... });
             * @example _converse.api.waitUntil('roomsAutoJoined').then(() => { ... });
             */
            api.trigger('roomsAutoJoined');
        }

        async function onWindowStateChanged (data) {
            if (data.state === 'visible' && api.connection.connected()) {
                const rooms = await api.rooms.get();
                rooms.forEach(room => room.rejoinIfNecessary());
            }
        }

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('beforeTearDown', () => {
            const groupchats = _converse.chatboxes.where({'type': _converse.CHATROOMS_TYPE});
            groupchats.forEach(muc => u.safeSave(muc.session, {'connection_status': converse.ROOMSTATUS.DISCONNECTED}));
        });

        api.listen.on('windowStateChanged', onWindowStateChanged);

        api.listen.on('addClientFeatures', () => {
            if (api.settings.get('allow_muc')) {
                api.disco.own.features.add(Strophe.NS.MUC);
            }
            if (api.settings.get('allow_muc_invitations')) {
                api.disco.own.features.add('jabber:x:conference'); // Invites
            }
        });
        api.listen.on('chatBoxesFetched', autoJoinRooms);


        api.listen.on('beforeResourceBinding', () => {
            _converse.connection.addHandler(stanza => {
                const muc_jid = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
                if (!_converse.chatboxes.get(muc_jid)) {
                    api.waitUntil('chatBoxesFetched')
                        .then(async () => {
                            const muc = _converse.chatboxes.get(muc_jid);
                            if (muc) {
                                await muc.initialized;
                                muc.message_handler.run(stanza);
                            }
                        });
                }
                return true;
            }, null, 'message', 'groupchat')
        });


        function disconnectChatRooms () {
            /* When disconnecting, mark all groupchats as
             * disconnected, so that they will be properly entered again
             * when fetched from session storage.
             */
            return _converse.chatboxes
                .filter(m => (m.get('type') === _converse.CHATROOMS_TYPE))
                .forEach(m => m.session.save({'connection_status': converse.ROOMSTATUS.DISCONNECTED}));
        }
        api.listen.on('disconnected', disconnectChatRooms);

        api.listen.on('statusInitialized', () => {
            window.addEventListener(_converse.unloadevent, () => {
                const using_websocket = api.connection.isType('websocket');
                if (using_websocket &&
                        (!api.settings.get('enable_smacks') || !_converse.session.get('smacks_stream_id'))) {
                    // For non-SMACKS websocket connections, or non-resumeable
                    // connections, we disconnect all chatrooms when the page unloads.
                    // See issue #1111
                    disconnectChatRooms();
                }
            });
        });
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        converse.env.muc_utils = muc_utils;

        // We extend the default converse.js API to add methods specific to MUC groupchats.
        Object.assign(api, {
            /**
             * The "rooms" namespace groups methods relevant to chatrooms
             * (aka groupchats).
             *
             * @namespace api.rooms
             * @memberOf api
             */
            rooms: {
                /**
                 * Creates a new MUC chatroom (aka groupchat)
                 *
                 * Similar to {@link api.rooms.open}, but creates
                 * the chatroom in the background (i.e. doesn't cause a view to open).
                 *
                 * @method api.rooms.create
                 * @param {(string[]|string)} jid|jids The JID or array of
                 *     JIDs of the chatroom(s) to create
                 * @param {object} [attrs] attrs The room attributes
                 * @returns {Promise} Promise which resolves with the Model representing the chat.
                 */
                create (jids, attrs={}) {
                    attrs = typeof attrs === 'string' ? {'nick': attrs} : (attrs || {});
                    if (!attrs.nick && api.settings.get('muc_nickname_from_jid')) {
                        attrs.nick = Strophe.getNodeFromJid(_converse.bare_jid);
                    }
                    if (jids === undefined) {
                        throw new TypeError('rooms.create: You need to provide at least one JID');
                    } else if (typeof jids === 'string') {
                        return api.rooms.get(u.getJIDFromURI(jids), attrs, true);
                    }
                    return jids.map(jid => api.rooms.get(u.getJIDFromURI(jid), attrs, true));
                },

                /**
                 * Opens a MUC chatroom (aka groupchat)
                 *
                 * Similar to {@link api.chats.open}, but for groupchats.
                 *
                 * @method api.rooms.open
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
                 * @param {boolean} [attrs.minimized] A boolean, indicating whether the room should be opened minimized or not.
                 * @param {boolean} [attrs.bring_to_foreground] A boolean indicating whether the room should be
                 *     brought to the foreground and therefore replace the currently shown chat.
                 *     If there is no chat currently open, then this option is ineffective.
                 * @param {Boolean} [force=false] - By default, a minimized
                 *   room won't be maximized (in `overlayed` view mode) and in
                 *   `fullscreen` view mode a newly opened room won't replace
                 *   another chat already in the foreground.
                 *   Set `force` to `true` if you want to force the room to be
                 *   maximized or shown.
                 * @returns {Promise} Promise which resolves with the Model representing the chat.
                 *
                 * @example
                 * this.api.rooms.open('group@muc.example.com')
                 *
                 * @example
                 * // To return an array of rooms, provide an array of room JIDs:
                 * api.rooms.open(['group1@muc.example.com', 'group2@muc.example.com'])
                 *
                 * @example
                 * // To setup a custom nickname when joining the room, provide the optional nick argument:
                 * api.rooms.open('group@muc.example.com', {'nick': 'mycustomnick'})
                 *
                 * @example
                 * // For example, opening a room with a specific default configuration:
                 * api.rooms.open(
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
                 *     }
                 * );
                 */
                async open (jids, attrs={}, force=false) {
                    await api.waitUntil('chatBoxesFetched');
                    if (jids === undefined) {
                        const err_msg = 'rooms.open: You need to provide at least one JID';
                        log.error(err_msg);
                        throw(new TypeError(err_msg));
                    } else if (typeof jids === 'string') {
                        const room = await api.rooms.get(jids, attrs, true);
                        room && room.maybeShow(force);
                        return room;
                    } else {
                        const rooms = await Promise.all(jids.map(jid => api.rooms.get(jid, attrs, true)));
                        rooms.forEach(r => r.maybeShow(force));
                        return rooms;
                    }
                },

                /**
                 * Fetches the object representing a MUC chatroom (aka groupchat)
                 *
                 * @method api.rooms.get
                 * @param {string} [jid] The room JID (if not specified, all rooms will be returned).
                 * @param {object} [attrs] A map containing any extra room attributes For example, if you want
                 *     to specify a nickname and password, use `{'nick': 'bloodninja', 'password': 'secret'}`.
                 * @param {boolean} create A boolean indicating whether the room should be created
                 *     if not found (default: `false`)
                 * @returns { Promise<_converse.ChatRoom> }
                 * @example
                 * api.waitUntil('roomsAutoJoined').then(() => {
                 *     const create_if_not_found = true;
                 *     api.rooms.get(
                 *         'group@muc.example.com',
                 *         {'nick': 'dread-pirate-roberts'},
                 *         create_if_not_found
                 *     )
                 * });
                 */
                async get (jids, attrs={}, create=false) {
                    async function _get (jid) {
                        jid = u.getJIDFromURI(jid);
                        let model = await api.chatboxes.get(jid);
                        if (!model && create) {
                            model = await api.chatboxes.create(jid, attrs, _converse.ChatRoom);
                        } else {
                            model = (model && model.get('type') === _converse.CHATROOMS_TYPE) ? model : null;
                            if (model && Object.keys(attrs).length) {
                                model.save(attrs);
                            }
                        }
                        return model;
                    }
                    if (jids === undefined) {
                        const chats = await api.chatboxes.get();
                        return chats.filter(c => (c.get('type') === _converse.CHATROOMS_TYPE));
                    } else if (typeof jids === 'string') {
                        return _get(jids);
                    }
                    return Promise.all(jids.map(jid => _get(jid)));
                }
            }
        });
        /************************ END API ************************/
    }
});
