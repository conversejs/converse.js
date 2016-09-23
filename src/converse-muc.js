// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define("converse-muc", [
            "converse-core",
            "converse-api",
            "tpl!chatarea",
            "tpl!chatroom",
            "tpl!chatroom_form",
            "tpl!chatroom_nickname_form",
            "tpl!chatroom_password_form",
            "tpl!chatroom_sidebar",
            "tpl!chatrooms_tab",
            "tpl!info",
            "tpl!occupant",
            "tpl!room_description",
            "tpl!room_item",
            "tpl!room_panel",
            "typeahead",
            "converse-chatview"
    ], factory);
}(this, function (
            converse,
            converse_api,
            tpl_chatarea,
            tpl_chatroom,
            tpl_chatroom_form,
            tpl_chatroom_nickname_form,
            tpl_chatroom_password_form,
            tpl_chatroom_sidebar,
            tpl_chatrooms_tab,
            tpl_info,
            tpl_occupant,
            tpl_room_description,
            tpl_room_item,
            tpl_room_panel
    ) {
    "use strict";
    converse.templates.chatarea = tpl_chatarea;
    converse.templates.chatroom = tpl_chatroom;
    converse.templates.chatroom_form = tpl_chatroom_form;
    converse.templates.chatroom_nickname_form = tpl_chatroom_nickname_form;
    converse.templates.chatroom_password_form = tpl_chatroom_password_form;
    converse.templates.chatroom_sidebar = tpl_chatroom_sidebar;
    converse.templates.chatrooms_tab = tpl_chatrooms_tab;
    converse.templates.info = tpl_info;
    converse.templates.occupant = tpl_occupant;
    converse.templates.room_description = tpl_room_description;
    converse.templates.room_item = tpl_room_item;
    converse.templates.room_panel = tpl_room_panel;

    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        $build = converse_api.env.$build,
        $msg = converse_api.env.$msg,
        $pres = converse_api.env.$pres,
        b64_sha1 = converse_api.env.b64_sha1,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        moment = converse_api.env.moment;

    // For translations
    var __ = utils.__.bind(converse);
    var ___ = utils.___;

    // Add Strophe Namespaces
    Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
    Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
    Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
    Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
    Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");

    converse_api.plugins.add('converse-muc', {
        /* Optional dependencies are other plugins which might be
         * overridden or relied upon, if they exist, otherwise they're ignored.
         *
         * However, if the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found.
         *
         * NB: These plugins need to have already been loaded via require.js.
         */
        optional_dependencies: ["converse-controlbox"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            wrappedChatBox: function (chatbox) {
                /* Wrap a chatbox for outside consumption (i.e. so that it can be
                * returned via the API.
                */
                if (!chatbox) { return; }
                var view = converse.chatboxviews.get(chatbox.get('id'));
                var box = this.__super__.wrappedChatBox.apply(this, arguments);
                box.is_chatroom = view.is_chatroom;
                return box;
            },

            Features: {
                addClientFeatures: function () {
                    this.__super__.addClientFeatures.apply(this, arguments);
                    if (converse.allow_muc_invitations) {
                        converse.connection.disco.addFeature('jabber:x:conference'); // Invites
                    }
                    if (converse.allow_muc) {
                        converse.connection.disco.addFeature(Strophe.NS.MUC);
                    }
                }
            },

            ControlBoxView: {
                renderContactsPanel: function () {
                    var converse = this.__super__.converse;
                    this.__super__.renderContactsPanel.apply(this, arguments);
                    if (converse.allow_muc) {
                        this.roomspanel = new converse.RoomsPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': new (Backbone.Model.extend({
                                id: b64_sha1('converse.roomspanel'+converse.bare_jid), // Required by sessionStorage
                                browserStorage: new Backbone.BrowserStorage[converse.storage](
                                    b64_sha1('converse.roomspanel'+converse.bare_jid))
                            }))()
                        });
                        this.roomspanel.render().model.fetch();
                        if (!this.roomspanel.model.get('nick')) {
                            this.roomspanel.model.save({
                                nick: Strophe.getNodeFromJid(converse.bare_jid)
                            });
                        }
                    }
                },

                onConnected: function () {
                    // TODO: This can probably be refactored to be an event
                    // handler (and therefore removed from overrides)
                    var converse = this.__super__.converse;
                    this.__super__.onConnected.apply(this, arguments);

                    if (this.model.get('connected')) {
                        converse.features.off('add', this.featureAdded, this);
                        converse.features.on('add', this.featureAdded, this);
                        // Features could have been added before the controlbox was
                        // initialized. We're only interested in MUC
                        var feature = converse.features.findWhere({
                            'var': Strophe.NS.MUC
                        });
                        if (feature) {
                            this.featureAdded(feature);
                        }
                    }
                },

                featureAdded: function (feature) {
                    var converse = this.__super__.converse;
                    if ((feature.get('var') === Strophe.NS.MUC) && (converse.allow_muc)) {
                        this.roomspanel.model.save({muc_domain: feature.get('from')});
                        var $server= this.$el.find('input.new-chatroom-server');
                        if (! $server.is(':focus')) {
                            $server.val(this.roomspanel.model.get('muc_domain'));
                        }
                    }
                }
            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view && item.get('type') === 'chatroom') {
                        view = new converse.ChatRoomView({'model': item});
                        return this.add(item.get('id'), view);
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            this.updateSettings({
                allow_muc: true,
                allow_muc_invitations: true,
                auto_join_on_invite: false,
                auto_join_rooms: [],
                auto_list_rooms: false,
                hide_muc_server: false,
                muc_history_max_stanzas: undefined,
                muc_instant_rooms: true,
                muc_nickname_from_jid: false,
                show_toolbar: true,
            });


            converse.ChatRoomView = converse.ChatBoxView.extend({
                /* Backbone View which renders a chat room, based upon the view
                 * for normal one-on-one chat boxes.
                 */
                length: 300,
                tagName: 'div',
                className: 'chatbox chatroom',
                is_chatroom: true,
                events: {
                    'click .close-chatbox-button': 'close',
                    'click .configure-chatroom-button': 'configureChatRoom',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click .toggle-smiley ul li': 'insertEmoticon',
                    'click .toggle-clear': 'clearChatRoomMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .toggle-occupants a': 'toggleOccupants',
                    'click .new-msgs-indicator': 'viewUnreadMessages',
                    'click .occupant': 'onOccupantClicked',
                    'keypress textarea.chat-textarea': 'keyPressed'
                },

                initialize: function () {
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:chat_state', this.sendChatState, this);

                    this.occupantsview = new converse.ChatRoomOccupantsView({
                        model: new converse.ChatRoomOccupants({nick: this.model.get('nick')})
                    });
                    var id = b64_sha1('converse.occupants'+converse.bare_jid+this.model.get('id')+this.model.get('nick'));
                    this.occupantsview.model.browserStorage = new Backbone.BrowserStorage.session(id);
                    this.occupantsview.chatroomview = this;

                    this.render().$el.hide();
                    this.occupantsview.model.fetch({add:true});
                    var nick = this.model.get('nick');
                    if (!nick) {
                        this.checkForReservedNick();
                    } else {
                        this.join(nick);
                    }

                    this.fetchMessages().insertIntoDOM();
                    // XXX: adding the event below to the events map above doesn't work.
                    // The code that gets executed because of that looks like this:
                    //      this.$el.on('scroll', '.chat-content', this.markScrolled.bind(this));
                    // Which for some reason doesn't work.
                    // So working around that fact here:
                    this.$el.find('.chat-content').on('scroll', this.markScrolled.bind(this));
                    converse.emit('chatRoomOpened', this);
                },

                insertIntoDOM: function () {
                    var view = converse.chatboxviews.get("controlbox");
                    if (view) {
                        this.$el.insertAfter(view.$el);
                    } else {
                        $('#conversejs').prepend(this.$el);
                    }
                    return this;
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                            .html(converse.templates.chatroom(this.model.toJSON()));
                    this.renderChatArea();
                    window.setTimeout(converse.refreshWebkit, 50);
                    return this;
                },

                renderChatArea: function () {
                    if (!this.$('.chat-area').length) {
                        this.$('.chatroom-body').empty()
                            .append(
                                converse.templates.chatarea({
                                    'unread_msgs': __('You have unread messages'),
                                    'show_toolbar': converse.show_toolbar,
                                    'label_message': __('Message')
                                }))
                            .append(this.occupantsview.render().$el);
                        this.renderToolbar();
                        this.$content = this.$el.find('.chat-content');
                    }
                    this.toggleOccupants(null, true);
                    return this;
                },

                close: function (ev) {
                    converse.connection.deleteHandler(this.handler);
                    this.leave();
                    converse.ChatBoxView.prototype.close.apply(this, arguments);
                },

                toggleOccupants: function (ev, preserve_state) {
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    if (preserve_state) {
                        // Bit of a hack, to make sure that the sidebar's state doesn't change
                        this.model.set({hidden_occupants: !this.model.get('hidden_occupants')});
                    }
                    if (!this.model.get('hidden_occupants')) {
                        this.model.save({hidden_occupants: true});
                        this.$('.icon-hide-users').removeClass('icon-hide-users').addClass('icon-show-users');
                        this.$('.occupants').addClass('hidden');
                        this.$('.chat-area').addClass('full');
                        this.scrollDown();
                    } else {
                        this.model.save({hidden_occupants: false});
                        this.$('.icon-show-users').removeClass('icon-show-users').addClass('icon-hide-users');
                        this.$('.chat-area').removeClass('full');
                        this.$('div.occupants').removeClass('hidden');
                        this.scrollDown();
                    }
                },

                onOccupantClicked: function (ev) {
                    /* When an occupant is clicked, insert their nickname into
                     * the chat textarea input.
                     */
                    this.insertIntoTextArea(ev.target.textContent);
                },

                directInvite: function (recipient, reason) {
                    var attrs = {
                        xmlns: 'jabber:x:conference',
                        jid: this.model.get('jid')
                    };
                    if (reason !== null) { attrs.reason = reason; }
                    if (this.model.get('password')) { attrs.password = this.model.get('password'); }
                    var invitation = $msg({
                        from: converse.connection.jid,
                        to: recipient,
                        id: converse.connection.getUniqueId()
                    }).c('x', attrs);
                    converse.connection.send(invitation);
                    converse.emit('roomInviteSent', {
                        'room': this,
                        'recipient': recipient,
                        'reason': reason
                    });
                },

                onCommandError: function (stanza) {
                    this.showStatusNotification(__("Error: could not execute the command"), true);
                },

                handleChatStateMessage: function (message) {
                    /* Override the method on the ChatBoxView base class to
                     * ignore <gone/> notifications in groupchats.
                     *
                     * As laid out in the business rules in XEP-0085
                     * http://xmpp.org/extensions/xep-0085.html#bizrules-groupchat
                     */
                    if (message.get('fullname') === this.model.get('nick')) {
                        // Don't know about other servers, but OpenFire sends
                        // back to you your own chat state notifications.
                        // We ignore them here...
                        return;
                    }
                    if (message.get('chat_state') !== converse.GONE) {
                        converse.ChatBoxView.prototype.handleChatStateMessage.apply(this, arguments);
                    }
                },

                sendChatState: function () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    var chat_state = this.model.get('chat_state');
                    if (chat_state === converse.GONE) {
                        // <gone/> is not applicable within MUC context
                        return;
                    }
                    converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'groupchat'})
                            .c(chat_state, {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                sendChatRoomMessage: function (text) {
                    var msgid = converse.connection.getUniqueId();
                    var msg = $msg({
                        to: this.model.get('jid'),
                        from: converse.connection.jid,
                        type: 'groupchat',
                        id: msgid
                    }).c("body").t(text).up()
                    .c("x", {xmlns: "jabber:x:event"}).c("composing");
                    converse.connection.send(msg);
                    this.model.messages.create({
                        fullname: this.model.get('nick'),
                        sender: 'me',
                        time: moment().format(),
                        message: text,
                        msgid: msgid
                    });
                },

                setAffiliation: function(room, jid, affiliation, reason, onSuccess, onError) {
                    var item = $build("item", {jid: jid, affiliation: affiliation});
                    var iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                    if (reason !== null) { iq.c("reason", reason); }
                    return converse.connection.sendIQ(iq.tree(), onSuccess, onError);
                },

                modifyRole: function(room, nick, role, reason, onSuccess, onError) {
                    var item = $build("item", {nick: nick, role: role});
                    var iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                    if (reason !== null) { iq.c("reason", reason); }
                    return converse.connection.sendIQ(iq.tree(), onSuccess, onError);
                },

                member: function(room, jid, reason, handler_cb, error_cb) {
                    return this.setAffiliation(room, jid, 'member', reason, handler_cb, error_cb);
                },
                revoke: function(room, jid, reason, handler_cb, error_cb) {
                    return this.setAffiliation(room, jid, 'none', reason, handler_cb, error_cb);
                },
                owner: function(room, jid, reason, handler_cb, error_cb) {
                    return this.setAffiliation(room, jid, 'owner', reason, handler_cb, error_cb);
                },
                admin: function(room, jid, reason, handler_cb, error_cb) {
                    return this.setAffiliation(room, jid, 'admin', reason, handler_cb, error_cb);
                },

                validateRoleChangeCommand: function (command, args) {
                    /* Check that a command to change a chat room user's role or
                     * affiliation has anough arguments.
                     */
                    // TODO check if first argument is valid
                    if (args.length < 1 || args.length > 2) {
                        this.showStatusNotification(
                            __("Error: the \""+command+"\" command takes two arguments, the user's nickname and optionally a reason."),
                            true
                        );
                        return false;
                    }
                    return true;
                },

                clearChatRoomMessages: function (ev) {
                    if (typeof ev !== "undefined") { ev.stopPropagation(); }
                    var result = confirm(__("Are you sure you want to clear the messages from this room?"));
                    if (result === true) {
                        this.$content.empty();
                    }
                    return this;
                },

                onMessageSubmitted: function (text) {
                    /* Gets called when the user presses enter to send off a
                     * message in a chat room.
                     *
                     * Parameters:
                     *    (String) text - The message text.
                     */
                    var match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''],
                        args = match[2] && match[2].splitOnce(' ') || [];
                    switch (match[1]) {
                        case 'admin':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'admin', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'ban':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'outcast', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'clear':
                            this.clearChatRoomMessages();
                            break;
                        case 'deop':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'help':
                            this.showHelpMessages([
                                '<strong>/admin</strong>: ' +__("Change user's affiliation to admin"),
                                '<strong>/ban</strong>: '   +__('Ban user from room'),
                                '<strong>/clear</strong>: ' +__('Remove messages'),
                                '<strong>/deop</strong>: '  +__('Change user role to occupant'),
                                '<strong>/help</strong>: '  +__('Show this menu'),
                                '<strong>/kick</strong>: '  +__('Kick user from room'),
                                '<strong>/me</strong>: '    +__('Write in 3rd person'),
                                '<strong>/member</strong>: '+__('Grant membership to a user'),
                                '<strong>/mute</strong>: '  +__("Remove user's ability to post messages"),
                                '<strong>/nick</strong>: '  +__('Change your nickname'),
                                '<strong>/op</strong>: '    +__('Grant moderator role to user'),
                                '<strong>/owner</strong>: ' +__('Grant ownership of this room'),
                                '<strong>/revoke</strong>: '+__("Revoke user's membership"),
                                '<strong>/topic</strong>: ' +__('Set room topic'),
                                '<strong>/voice</strong>: ' +__('Allow muted user to post messages')
                            ]);
                            break;
                        case 'kick':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'none', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'mute':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'visitor', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'member':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'member', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'nick':
                            converse.connection.send($pres({
                                from: converse.connection.jid,
                                to: this.getRoomJIDAndNick(match[2]),
                                id: converse.connection.getUniqueId()
                            }).tree());
                            break;
                        case 'owner':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'owner', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'op':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'moderator', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'revoke':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'none', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'topic':
                            converse.connection.send(
                                $msg({
                                    to: this.model.get('jid'),
                                    from: converse.connection.jid,
                                    type: "groupchat"
                                }).c("subject", {xmlns: "jabber:client"}).t(match[2]).tree()
                            );
                            break;
                        case 'voice':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        default:
                            this.sendChatRoomMessage(text);
                        break;
                    }
                },

                handleMUCStanza: function (stanza) {
                    var xmlns, xquery, i;
                    var from = stanza.getAttribute('from');
                    var is_mam = $(stanza).find('[xmlns="'+Strophe.NS.MAM+'"]').length > 0;
                    if (!from || (this.model.get('id') !== from.split("/")[0])  || is_mam) {
                        return true;
                    }
                    if (stanza.nodeName === "message") {
                        _.compose(this.onChatRoomMessage.bind(this), this.showStatusMessages.bind(this))(stanza);
                    } else if (stanza.nodeName === "presence") {
                        xquery = stanza.getElementsByTagName("x");
                        if (xquery.length > 0) {
                            for (i = 0; i < xquery.length; i++) {
                                xmlns = xquery[i].getAttribute("xmlns");
                                if (xmlns && xmlns.match(Strophe.NS.MUC)) {
                                    this.onChatRoomPresence(stanza);
                                    break;
                                }
                            }
                        }
                    }
                    return true;
                },

                getRoomJIDAndNick: function (nick) {
                    if (nick) {
                        this.model.save({'nick': nick});
                    } else {
                        nick = this.model.get('nick');
                    }
                    var room = this.model.get('jid');
                    var node = Strophe.getNodeFromJid(room);
                    var domain = Strophe.getDomainFromJid(room);
                    return node + "@" + domain + (nick !== null ? "/" + nick : "");
                },

                join: function (nick, password) {
                    var stanza = $pres({
                        'from': converse.connection.jid,
                        'to': this.getRoomJIDAndNick(nick)
                    }).c("x", {'xmlns': Strophe.NS.MUC})
                      .c("history", {'maxstanzas': converse.muc_history_max_stanzas}).up();
                    if (password) {
                        stanza.cnode(Strophe.xmlElement("password", [], password));
                    }
                    if (!this.handler) {
                        this.handler = converse.connection.addHandler(this.handleMUCStanza.bind(this));
                    }
                    this.model.set('connection_status', Strophe.Status.CONNECTING);
                    return converse.connection.send(stanza);
                },

                leave: function(exit_msg) {
                    var presenceid = converse.connection.getUniqueId();
                    var presence = $pres({
                        type: "unavailable",
                        id: presenceid,
                        from: converse.connection.jid,
                        to: this.getRoomJIDAndNick()
                    });
                    if (exit_msg !== null) {
                        presence.c("status", exit_msg);
                    }
                    converse.connection.addHandler(
                        function () {
                            this.model.set('connection_status', Strophe.Status.DISCONNECTED);
                        }.bind(this),
                        null, "presence", null, presenceid);
                    converse.connection.send(presence);
                },

                renderConfigurationForm: function (stanza) {
                    var $form = this.$el.find('form.chatroom-form'),
                        $fieldset = $form.children('fieldset:first'),
                        $stanza = $(stanza),
                        $fields = $stanza.find('field'),
                        title = $stanza.find('title').text(),
                        instructions = $stanza.find('instructions').text();
                    $fieldset.find('span.spinner').remove();
                    $fieldset.append($('<legend>').text(title));
                    if (instructions && instructions !== title) {
                        $fieldset.append($('<p class="instructions">').text(instructions));
                    }
                    _.each($fields, function (field) {
                        $fieldset.append(utils.xForm2webForm($(field), $stanza));
                    });
                    $form.append('<fieldset></fieldset>');
                    $fieldset = $form.children('fieldset:last');
                    $fieldset.append('<input type="submit" class="pure-button button-primary" value="'+__('Save')+'"/>');
                    $fieldset.append('<input type="button" class="pure-button button-cancel" value="'+__('Cancel')+'"/>');
                    $fieldset.find('input[type=button]').on('click', this.cancelConfiguration.bind(this));
                    $form.on('submit', this.saveConfiguration.bind(this));
                },

                sendConfiguration: function(config, onSuccess, onError) {
                    // Send an IQ stanza with the room configuration.
                    var iq = $iq({to: this.model.get('jid'), type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                        .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                    _.each(config, function (node) { iq.cnode(node).up(); });
                    return converse.connection.sendIQ(iq.tree(), onSuccess, onError);
                },

                saveConfiguration: function (ev) {
                    ev.preventDefault();
                    var that = this;
                    var $inputs = $(ev.target).find(':input:not([type=button]):not([type=submit])'),
                        count = $inputs.length,
                        configArray = [];
                    $inputs.each(function () {
                        configArray.push(utils.webForm2xForm(this));
                        if (!--count) {
                            that.sendConfiguration(
                                configArray,
                                that.onConfigSaved.bind(that),
                                that.onErrorConfigSaved.bind(that)
                            );
                        }
                    });
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.$el.find('.chat-area').removeClass('hidden');
                            that.$el.find('.occupants').removeClass('hidden');
                        });
                },

                onConfigSaved: function (stanza) {
                    // TODO: provide feedback
                },

                onErrorConfigSaved: function (stanza) {
                    this.showStatusNotification(__("An error occurred while trying to save the form."));
                },

                cancelConfiguration: function (ev) {
                    ev.preventDefault();
                    var that = this;
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.$el.find('.chat-area').removeClass('hidden');
                            that.$el.find('.occupants').removeClass('hidden');
                        });
                },

                configureChatRoom: function (ev) {
                    if (typeof ev !== 'undefined' && ev.preventDefault) {
                        ev.preventDefault();
                    }
                    if (this.$el.find('div.chatroom-form-container').length) {
                        return;
                    }
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$('.chatroom-body').append(converse.templates.chatroom_form());
                    converse.connection.sendIQ(
                            $iq({
                                to: this.model.get('jid'),
                                type: "get"
                            }).c("query", {xmlns: Strophe.NS.MUC_OWNER}).tree(),
                            this.renderConfigurationForm.bind(this)
                    );
                },

                submitNickname: function (ev) {
                    ev.preventDefault();
                    var $nick = this.$el.find('input[name=nick]');
                    var nick = $nick.val();
                    if (!nick) {
                        $nick.addClass('error');
                        return;
                    }
                    else {
                        $nick.removeClass('error');
                    }
                    this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                    this.join(nick);
                },

                checkForReservedNick: function () {
                    /* User service-discovery to as the XMPP server whether
                     * this user has a reserved nickname for this room.
                     * If so, we'll use that, otherwise we render the nickname
                     * form.
                     */
                    this.showSpinner();
                    converse.connection.sendIQ(
                        $iq({
                            'to': this.model.get('jid'),
                            'from': converse.connection.jid,
                            'type': "get"
                        }).c("query", {
                            'xmlns': Strophe.NS.DISCO_INFO,
                            'node': 'x-roomuser-item'
                        }),
                        this.onNickNameFound.bind(this),
                        this.onNickNameNotFound.bind(this)
                    );
                },

                onNickNameFound: function (iq) {
                    /* We've received an IQ response from the server which
                     * might contain the user's reserved nickname.
                     * If no nickname is found, we render a form for them to
                     * specify one.
                     */
                    var nick = $(iq)
                        .find('query[node="x-roomuser-item"] identity')
                        .attr('name');
                    if (!nick) {
                        this.onNickNameNotFound();
                    } else {
                        this.join(nick);
                    }
                },

                onNickNameNotFound: function (message) {
                    if (converse.muc_nickname_from_jid) {
                        // We try to enter the room with the node part of
                        // the user's JID.
                        this.join(Strophe.unescapeNode(Strophe.getNodeFromJid(converse.bare_jid)));
                    } else {
                        this.renderNicknameForm(message);
                    }
                },

                getDefaultNickName: function () {
                    /* The default nickname (used when muc_nickname_from_jid is true)
                     * is the node part of the user's JID.
                     * We put this in a separate method so that it can be
                     * overridden by plugins.
                     */
                    return Strophe.unescapeNode(Strophe.getNodeFromJid(converse.bare_jid));
                },

                onNicknameClash: function (presence) {
                    /* When the nickname is already taken, we either render a
                     * form for the user to choose a new nickname, or we
                     * try to make the nickname unique by adding an integer to
                     * it. So john will become john-2, and then john-3 and so on.
                     *
                     * Which option is take depends on the value of
                     * muc_nickname_from_jid.
                     */
                    if (converse.muc_nickname_from_jid) {
                        var nick = presence.getAttribute('from').split('/')[1];
                        if (nick === this.getDefaultNickName()) {
                            this.join(nick + '-2');
                        } else {
                            var del= nick.lastIndexOf("-");
                            var num = nick.substring(del+1, nick.length);
                            this.join(nick.substring(0, del+1) + String(Number(num)+1));
                        }
                    } else {
                        this.renderNicknameForm(
                            __("The nickname you chose is reserved or currently in use, please choose a different one.")
                        );
                    }
                },

                renderNicknameForm: function (message) {
                    /* Render a form which allows the user to choose their
                     * nickname.
                     */
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    if (typeof message !== "string") {
                        message = '';
                    }
                    this.$('.chatroom-body').append(
                        converse.templates.chatroom_nickname_form({
                            heading: __('Please choose your nickname'),
                            label_nickname: __('Nickname'),
                            label_join: __('Enter room'),
                            validation_message: message
                        }));
                    this.$('.chatroom-form').on('submit', this.submitNickname.bind(this));
                },

                submitPassword: function (ev) {
                    ev.preventDefault();
                    var password = this.$el.find('.chatroom-form').find('input[type=password]').val();
                    this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                    this.join(this.model.get('nick'), password);
                },

                renderPasswordForm: function () {
                    this.$('.chatroom-body').children().hide();
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append(
                        converse.templates.chatroom_password_form({
                            heading: __('This chatroom requires a password'),
                            label_password: __('Password: '),
                            label_submit: __('Submit')
                        }));
                    this.$('.chatroom-form').on('submit', this.submitPassword.bind(this));
                },

                showDisconnectMessage: function (msg) {
                    this.$('.chat-area').hide();
                    this.$('.occupants').hide();
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append($('<p>'+msg+'</p>'));
                },

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
                infoMessages: {
                    100: __('This room is not anonymous'),
                    102: __('This room now shows unavailable members'),
                    103: __('This room does not show unavailable members'),
                    104: __('Non-privacy-related room configuration has changed'),
                    170: __('Room logging is now enabled'),
                    171: __('Room logging is now disabled'),
                    172: __('This room is now non-anonymous'),
                    173: __('This room is now semi-anonymous'),
                    174: __('This room is now fully-anonymous'),
                    201: __('A new room has been created')
                },

                disconnectMessages: {
                    301: __('You have been banned from this room'),
                    307: __('You have been kicked from this room'),
                    321: __("You have been removed from this room because of an affiliation change"),
                    322: __("You have been removed from this room because the room has changed to members-only and you're not a member"),
                    332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down.")
                },

                actionInfoMessages: {
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
                    301: ___("<strong>%1$s</strong> has been banned"),
                    303: ___("<strong>%1$s</strong>'s nickname has changed"),
                    307: ___("<strong>%1$s</strong> has been kicked out"),
                    321: ___("<strong>%1$s</strong> has been removed because of an affiliation change"),
                    322: ___("<strong>%1$s</strong> has been removed for not being a member")
                },

                newNicknameMessages: {
                    210: ___('Your nickname has been automatically set to: <strong>%1$s</strong>'),
                    303: ___('Your nickname has been changed to: <strong>%1$s</strong>')
                },

                showStatusMessages: function (el, is_self) {
                    /* Check for status codes and communicate their purpose to the user.
                     * Allow user to configure chat room if they are the owner.
                     * See: http://xmpp.org/registrar/mucstatus.html
                     */
                    var $el = $(el), i, disconnect_msgs = [], msgs = [], reasons = [];

                    $el.find('x[xmlns="'+Strophe.NS.MUC_USER+'"]').each(function (idx, x) {
                        var $item = $(x).find('item');
                        if (Strophe.getBareJidFromJid($item.attr('jid')) === converse.bare_jid && $item.attr('affiliation') === 'owner') {
                            this.$el.find('a.configure-chatroom-button').show();
                        }
                        $(x).find('item reason').each(function (idx, reason) {
                            if ($(reason).text()) {
                                reasons.push($(reason).text());
                            }
                        });
                        $(x).find('status').each(function (idx, stat) {
                            var code = stat.getAttribute('code');
                            var from_nick = Strophe.unescapeNode(Strophe.getResourceFromJid($el.attr('from')));
                            if (is_self && code === "210") {
                                msgs.push(__(this.newNicknameMessages[code], from_nick));
                            } else if (is_self && code === "303") {
                                msgs.push(__(this.newNicknameMessages[code], $item.attr('nick')));
                            } else if (is_self && _.contains(_.keys(this.disconnectMessages), code)) {
                                disconnect_msgs.push(this.disconnectMessages[code]);
                            } else if (!is_self && _.contains(_.keys(this.actionInfoMessages), code)) {
                                msgs.push(__(this.actionInfoMessages[code], from_nick));
                            } else if (_.contains(_.keys(this.infoMessages), code)) {
                                msgs.push(this.infoMessages[code]);
                            } else if (code !== '110') {
                                if ($(stat).text()) {
                                    msgs.push($(stat).text()); // Sometimes the status contains human readable text and not a code.
                                }
                            }
                        }.bind(this));
                    }.bind(this));

                    if (disconnect_msgs.length > 0) {
                        for (i=0; i<disconnect_msgs.length; i++) {
                            this.showDisconnectMessage(disconnect_msgs[i]);
                        }
                        for (i=0; i<reasons.length; i++) {
                            this.showDisconnectMessage(__('The reason given is: "'+reasons[i]+'"'), true);
                        }
                        this.model.set('connection_status', Strophe.Status.DISCONNECTED);
                        return;
                    }
                    for (i=0; i<msgs.length; i++) {
                        this.$content.append(converse.templates.info({message: msgs[i]}));
                    }
                    for (i=0; i<reasons.length; i++) {
                        this.showStatusNotification(__('The reason given is: "'+reasons[i]+'"'), true);
                    }
                    if (disconnect_msgs.length || msgs.length || reasons.length) {
                        this.scrollDown();
                    }
                    return el;
                },

                showErrorMessage: function (presence) {
                    // We didn't enter the room, so we must remove it from the MUC
                    // add-on
                    var $error = $(presence).find('error');
                    if ($error.attr('type') === 'auth') {
                        if ($error.find('not-authorized').length) {
                            this.renderPasswordForm();
                        } else if ($error.find('registration-required').length) {
                            this.showDisconnectMessage(__('You are not on the member list of this room'));
                        } else if ($error.find('forbidden').length) {
                            this.showDisconnectMessage(__('You have been banned from this room'));
                        }
                    } else if ($error.attr('type') === 'modify') {
                        if ($error.find('jid-malformed').length) {
                            this.showDisconnectMessage(__('No nickname was specified'));
                        }
                    } else if ($error.attr('type') === 'cancel') {
                        if ($error.find('not-allowed').length) {
                            this.showDisconnectMessage(__('You are not allowed to create new rooms'));
                        } else if ($error.find('not-acceptable').length) {
                            this.showDisconnectMessage(__("Your nickname doesn't conform to this room's policies"));
                        } else if ($error.find('conflict').length) {
                            this.onNicknameClash(presence);
                        } else if ($error.find('item-not-found').length) {
                            this.showDisconnectMessage(__("This room does not (yet) exist"));
                        } else if ($error.find('service-unavailable').length) {
                            this.showDisconnectMessage(__("This room has reached its maximum number of occupants"));
                        }
                    }
                },

                showSpinner: function () {
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$el.find('.chatroom-body').prepend('<span class="spinner centered"/>');
                },

                hideSpinner: function () {
                    /* Check if the spinner is being shown and if so, hide it.
                     * Also make sure then that the chat area and occupants
                     * list are both visible.
                     */
                    var that = this;
                    var $spinner = this.$el.find('.spinner');
                    if ($spinner.length) {
                        $spinner.hide(function () {
                            $(this).remove();
                            that.$el.find('.chat-area').removeClass('hidden');
                            that.$el.find('.occupants').removeClass('hidden');
                            that.scrollDown();
                        });
                    }
                    return this;
                },

                onChatRoomPresence: function (pres) {
                    var $presence = $(pres), is_self, new_room;
                    var nick = this.model.get('nick');
                    if ($presence.attr('type') === 'error') {
                        this.model.set('connection_status', Strophe.Status.DISCONNECTED);
                        this.showErrorMessage(pres);
                    } else {
                        is_self = ($presence.find("status[code='110']").length) ||
                            ($presence.attr('from') === this.model.get('id')+'/'+Strophe.escapeNode(nick));
                        new_room = $presence.find("status[code='201']").length;

                        if (is_self) {
                            this.model.set('connection_status', Strophe.Status.CONNECTED);
                            if (!converse.muc_instant_rooms && new_room) {
                                this.configureChatRoom();
                            } else {
                                this.hideSpinner().showStatusMessages(pres, is_self);
                            }
                        }
                    }
                    this.occupantsview.updateOccupantsOnPresence(pres);
                },

                setChatRoomSubject: function (sender, subject) {
                    this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
                    // For translators: the %1$s and %2$s parts will get replaced by the user and topic text respectively
                    // Example: Topic set by JC Brand to: Hello World!
                    this.$content.append(
                        converse.templates.info({
                            'message': __('Topic set by %1$s to: %2$s', sender, subject)
                        }));
                    this.scrollDown();
                },

                onChatRoomMessage: function (message) {
                    var $message = $(message),
                        $forwarded = $message.find('forwarded'),
                        $delay;
                    if ($forwarded.length) {
                        $message = $forwarded.children('message');
                        $delay = $forwarded.children('delay');
                    }
                    var jid = $message.attr('from'),
                        msgid = $message.attr('id'),
                        resource = Strophe.getResourceFromJid(jid),
                        sender = resource && Strophe.unescapeNode(resource) || '',
                        subject = $message.children('subject').text(),
                        dupes = msgid && this.model.messages.filter(function (msg) {
                            // Find duplicates.
                            // Some bots (like HAL in the prosody chatroom)
                            // respond to commands with the same ID as the
                            // original message. So we also check the sender.
                            return msg.get('msgid') === msgid && msg.get('fullname') === sender;
                        });
                    if (dupes && dupes.length) {
                        return true;
                    }
                    if (subject) {
                        this.setChatRoomSubject(sender, subject);
                    }
                    if (sender === '') {
                        return true;
                    }
                    this.model.createMessage($message, $delay, message);
                    if (sender !== this.model.get('nick')) {
                        // We only emit an event if it's not our own message
                        converse.emit('message', message);
                    }
                    return true;
                },

                fetchArchivedMessages: function (options) {
                    /* Fetch archived chat messages from the XMPP server.
                     *
                     * Then, upon receiving them, call onChatRoomMessage
                     * so that they are displayed inside it.
                     */
                    if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        converse.log("Attempted to fetch archived messages but this user's server doesn't support XEP-0313");
                        return;
                    }
                    this.addSpinner();
                    converse_api.archive.query(_.extend(options, {'groupchat': true}),
                        function (messages) {
                            this.clearSpinner();
                            if (messages.length) {
                                _.map(messages, this.onChatRoomMessage.bind(this));
                            }
                        }.bind(this),
                        function () {
                            this.clearSpinner();
                            converse.log("Error while trying to fetch archived messages", "error");
                        }.bind(this)
                    );
                }
            });

            converse.ChatRoomOccupant = Backbone.Model.extend({
                initialize: function (attributes) {
                    this.set(_.extend({
                        'id': converse.connection.getUniqueId(),
                    }, attributes));
                }
            });

            converse.ChatRoomOccupantView = Backbone.View.extend({
                tagName: 'li',
                initialize: function () {
                    this.model.on('change', this.render, this);
                    this.model.on('destroy', this.destroy, this);
                },

                render: function () {
                    var new_el = converse.templates.occupant(
                        _.extend(
                            this.model.toJSON(), {
                                'hint_occupant': __('Click to mention this user in your message.'),
                                'desc_moderator': __('This user is a moderator.'),
                                'desc_occupant': __('This user can send messages in this room.'),
                                'desc_visitor': __('This user can NOT send messages in this room.')
                        })
                    );
                    var $parents = this.$el.parents();
                    if ($parents.length) {
                        this.$el.replaceWith(new_el);
                        this.setElement($parents.first().children('#'+this.model.get('id')), true);
                        this.delegateEvents();
                    } else {
                        this.$el.replaceWith(new_el);
                        this.setElement(new_el, true);
                    }
                    return this;
                },

                destroy: function () {
                    this.$el.remove();
                }
            });

            converse.ChatRoomOccupants = Backbone.Collection.extend({
                model: converse.ChatRoomOccupant
            });

            converse.ChatRoomOccupantsView = Backbone.Overview.extend({
                tagName: 'div',
                className: 'occupants',

                initialize: function () {
                    this.model.on("add", this.onOccupantAdded, this);
                },

                render: function () {
                    this.$el.html(
                        converse.templates.chatroom_sidebar({
                            'allow_muc_invitations': converse.allow_muc_invitations,
                            'label_invitation': __('Invite'),
                            'label_occupants': __('Occupants')
                        })
                    );
                    if (converse.allow_muc_invitations) {
                        return this.initInviteWidget();
                    }
                    return this;
                },

                onOccupantAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = this.add(item.get('id'), new converse.ChatRoomOccupantView({model: item}));
                    } else {
                        delete view.model; // Remove ref to old model to help garbage collection
                        view.model = item;
                        view.initialize();
                    }
                    this.$('.occupant-list').append(view.render().$el);
                },

                parsePresence: function (pres) {
                    var id = Strophe.getResourceFromJid(pres.getAttribute("from"));
                    var data = {
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
                                data.show = child.textContent || null;
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

                findOccupant: function (data) {
                    /* Try to find an existing occupant based on the passed in
                     * data object.
                     *
                     * If we have a JID, we use that as lookup variable,
                     * otherwise we use the nick. We don't always have both,
                     * but should have at least one or the other.
                     */
                    var jid = Strophe.getBareJidFromJid(data.jid);
                    if (jid !== null) {
                        return this.model.where({'jid': jid}).pop();
                    } else {
                        return this.model.where({'nick': data.nick}).pop();
                    }
                },

                updateOccupantsOnPresence: function (pres) {
                    var data = this.parsePresence(pres);
                    if (data.type === 'error') {
                        return true;
                    }
                    var occupant = this.findOccupant(data);
                    switch (data.type) {
                        case 'unavailable':
                            if (occupant) { occupant.destroy(); }
                            break;
                        default:
                            var jid = Strophe.getBareJidFromJid(data.jid);
                            var attributes = _.extend(data, {
                                'jid': jid ? jid : undefined,
                                'resource': data.jid ? Strophe.getResourceFromJid(data.jid) : undefined
                            });
                            if (occupant) {
                                occupant.save(attributes);
                            } else {
                                this.model.create(attributes);
                            }
                    }
                },

                initInviteWidget: function () {
                    var $el = this.$('input.invited-contact');
                    $el.typeahead({
                        minLength: 1,
                        highlight: true
                    }, {
                        name: 'contacts-dataset',
                        source: function (q, cb) {
                            var results = [];
                            _.each(converse.roster.filter(utils.contains(['fullname', 'jid'], q)), function (n) {
                                results.push({value: n.get('fullname'), jid: n.get('jid')});
                            });
                            cb(results);
                        },
                        templates: {
                            suggestion: _.template('<p data-jid="{{jid}}">{{value}}</p>')
                        }
                    });
                    $el.on('typeahead:selected', function (ev, suggestion, dname) {
                        var reason = prompt(
                            __(___('You are about to invite %1$s to the chat room "%2$s". '), suggestion.value, this.model.get('id')) +
                            __("You may optionally include a message, explaining the reason for the invitation.")
                        );
                        if (reason !== null) {
                            this.chatroomview.directInvite(suggestion.jid, reason);
                        }
                        $(ev.target).typeahead('val', '');
                    }.bind(this));
                    return this;
                }
            });

            converse.RoomsPanel = Backbone.View.extend({
                /* Backbone View which renders the "Rooms" tab and accompanying
                 * panel in the control box.
                 *
                 * In this panel, chat rooms can be listed, joined and new rooms
                 * can be created.
                 */
                tagName: 'div',
                className: 'controlbox-pane',
                id: 'chatrooms',
                events: {
                    'submit form.add-chatroom': 'createChatRoom',
                    'click input#show-rooms': 'showRooms',
                    'click a.open-room': 'createChatRoom',
                    'click a.room-info': 'showRoomInfo',
                    'change input[name=server]': 'setDomain',
                    'change input[name=nick]': 'setNick'
                },

                initialize: function (cfg) {
                    this.$parent = cfg.$parent;
                    this.model.on('change:muc_domain', this.onDomainChange, this);
                    this.model.on('change:nick', this.onNickChange, this);
                },

                render: function () {
                    this.$parent.append(
                        this.$el.html(
                            converse.templates.room_panel({
                                'server_input_type': converse.hide_muc_server && 'hidden' || 'text',
                                'server_label_global_attr': converse.hide_muc_server && ' hidden' || '',
                                'label_room_name': __('Room name'),
                                'label_nickname': __('Nickname'),
                                'label_server': __('Server'),
                                'label_join': __('Join Room'),
                                'label_show_rooms': __('Show rooms')
                            })
                        ).hide());
                    this.$tabs = this.$parent.parent().find('#controlbox-tabs');
                    this.$tabs.append(converse.templates.chatrooms_tab({label_rooms: __('Rooms')}));
                    return this;
                },

                onDomainChange: function (model) {
                    var $server = this.$el.find('input.new-chatroom-server');
                    $server.val(model.get('muc_domain'));
                    if (converse.auto_list_rooms) {
                        this.updateRoomsList();
                    }
                },

                onNickChange: function (model) {
                    var $nick = this.$el.find('input.new-chatroom-nick');
                    $nick.val(model.get('nick'));
                },

                informNoRoomsFound: function () {
                    var $available_chatrooms = this.$el.find('#available-chatrooms');
                    // For translators: %1$s is a variable and will be replaced with the XMPP server name
                    $available_chatrooms.html('<dt>'+__('No rooms on %1$s',this.model.get('muc_domain'))+'</dt>');
                    $('input#show-rooms').show().siblings('span.spinner').remove();
                },

                onRoomsFound: function (iq) {
                    /* Handle the IQ stanza returned from the server, containing
                     * all its public rooms.
                     */
                    var name, jid, i, fragment,
                        $available_chatrooms = this.$el.find('#available-chatrooms');
                    this.rooms = $(iq).find('query').find('item');
                    if (this.rooms.length) {
                        // For translators: %1$s is a variable and will be
                        // replaced with the XMPP server name
                        $available_chatrooms.html('<dt>'+__('Rooms on %1$s',this.model.get('muc_domain'))+'</dt>');
                        fragment = document.createDocumentFragment();
                        for (i=0; i<this.rooms.length; i++) {
                            name = Strophe.unescapeNode($(this.rooms[i]).attr('name')||$(this.rooms[i]).attr('jid'));
                            jid = $(this.rooms[i]).attr('jid');
                            fragment.appendChild($(
                                converse.templates.room_item({
                                    'name':name,
                                    'jid':jid,
                                    'open_title': __('Click to open this room'),
                                    'info_title': __('Show more information on this room')
                                    })
                                )[0]);
                        }
                        $available_chatrooms.append(fragment);
                        $('input#show-rooms').show().siblings('span.spinner').remove();
                    } else {
                        this.informNoRoomsFound();
                    }
                    return true;
                },

                updateRoomsList: function () {
                    /* Send and IQ stanza to the server asking for all rooms
                     */
                    converse.connection.sendIQ(
                        $iq({
                            to: this.model.get('muc_domain'),
                            from: converse.connection.jid,
                            type: "get"
                        }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS}),
                        this.onRoomsFound.bind(this),
                        this.informNoRoomsFound.bind(this)
                    );
                },

                showRooms: function () {
                    var $available_chatrooms = this.$el.find('#available-chatrooms');
                    var $server = this.$el.find('input.new-chatroom-server');
                    var server = $server.val();
                    if (!server) {
                        $server.addClass('error');
                        return;
                    }
                    this.$el.find('input.new-chatroom-name').removeClass('error');
                    $server.removeClass('error');
                    $available_chatrooms.empty();
                    $('input#show-rooms').hide().after('<span class="spinner"/>');
                    this.model.save({muc_domain: server});
                    this.updateRoomsList();
                },

                showRoomInfo: function (ev) {
                    var target = ev.target,
                        $dd = $(target).parent('dd'),
                        $div = $dd.find('div.room-info');
                    if ($div.length) {
                        $div.remove();
                    } else {
                        $dd.find('span.spinner').remove();
                        $dd.append('<span class="spinner hor_centered"/>');
                        converse.connection.disco.info(
                            $(target).attr('data-room-jid'),
                            null,
                            function (stanza) {
                                var $stanza = $(stanza);
                                // All MUC features found here: http://xmpp.org/registrar/disco-features.html
                                $dd.find('span.spinner').replaceWith(
                                    converse.templates.room_description({
                                        'desc': $stanza.find('field[var="muc#roominfo_description"] value').text(),
                                        'occ': $stanza.find('field[var="muc#roominfo_occupants"] value').text(),
                                        'hidden': $stanza.find('feature[var="muc_hidden"]').length,
                                        'membersonly': $stanza.find('feature[var="muc_membersonly"]').length,
                                        'moderated': $stanza.find('feature[var="muc_moderated"]').length,
                                        'nonanonymous': $stanza.find('feature[var="muc_nonanonymous"]').length,
                                        'open': $stanza.find('feature[var="muc_open"]').length,
                                        'passwordprotected': $stanza.find('feature[var="muc_passwordprotected"]').length,
                                        'persistent': $stanza.find('feature[var="muc_persistent"]').length,
                                        'publicroom': $stanza.find('feature[var="muc_public"]').length,
                                        'semianonymous': $stanza.find('feature[var="muc_semianonymous"]').length,
                                        'temporary': $stanza.find('feature[var="muc_temporary"]').length,
                                        'unmoderated': $stanza.find('feature[var="muc_unmoderated"]').length,
                                        'label_desc': __('Description:'),
                                        'label_occ': __('Occupants:'),
                                        'label_features': __('Features:'),
                                        'label_requires_auth': __('Requires authentication'),
                                        'label_hidden': __('Hidden'),
                                        'label_requires_invite': __('Requires an invitation'),
                                        'label_moderated': __('Moderated'),
                                        'label_non_anon': __('Non-anonymous'),
                                        'label_open_room': __('Open room'),
                                        'label_permanent_room': __('Permanent room'),
                                        'label_public': __('Public'),
                                        'label_semi_anon':  __('Semi-anonymous'),
                                        'label_temp_room':  __('Temporary room'),
                                        'label_unmoderated': __('Unmoderated')
                                    }));
                            }.bind(this));
                    }
                },

                createChatRoom: function (ev) {
                    ev.preventDefault();
                    var name, $name, server, $server, jid, chatroom;
                    if (ev.type === 'click') {
                        name = $(ev.target).text();
                        jid = $(ev.target).attr('data-room-jid');
                    } else {
                        $name = this.$el.find('input.new-chatroom-name');
                        $server= this.$el.find('input.new-chatroom-server');
                        server = $server.val();
                        name = $name.val().trim();
                        $name.val(''); // Clear the input
                        if (name && server) {
                            jid = Strophe.escapeNode(name.toLowerCase()) + '@' + server.toLowerCase();
                            $name.removeClass('error');
                            $server.removeClass('error');
                            this.model.save({muc_domain: server});
                        } else {
                            if (!name) { $name.addClass('error'); }
                            if (!server) { $server.addClass('error'); }
                            return;
                        }
                    }
                    chatroom = converse.chatboxviews.showChat({
                        'id': jid,
                        'jid': jid,
                        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                        'type': 'chatroom',
                        'box_id': b64_sha1(jid)
                    });
                },

                setDomain: function (ev) {
                    this.model.save({muc_domain: ev.target.value});
                },

                setNick: function (ev) {
                    this.model.save({nick: ev.target.value});
                }
            });

            /* Support for XEP-0249: Direct MUC invitations */
            /* ------------------------------------------------------------ */
            converse.onDirectMUCInvitation = function (message) {
                /*  A direct MUC invitation to join a room has been received */
                var $message = $(message),
                    $x = $message.children('x[xmlns="jabber:x:conference"]'),
                    from = Strophe.getBareJidFromJid($message.attr('from')),
                    room_jid = $x.attr('jid'),
                    reason = $x.attr('reason'),
                    contact = converse.roster.get(from),
                    result;

                if (converse.auto_join_on_invite) {
                    result = true;
                } else {
                    // Invite request might come from someone not your roster list
                    contact = contact? contact.get('fullname'): Strophe.getNodeFromJid(from);
                    if (!reason) {
                        result = confirm(
                            __(___("%1$s has invited you to join a chat room: %2$s"),
                                contact, room_jid)
                        );
                    } else {
                        result = confirm(
                            __(___('%1$s has invited you to join a chat room: %2$s, and left the following reason: "%3$s"'),
                                contact, room_jid, reason)
                        );
                    }
                }
                if (result === true) {
                    var chatroom = converse.chatboxviews.showChat({
                        'id': room_jid,
                        'jid': room_jid,
                        'name': Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)),
                        'nick': Strophe.unescapeNode(Strophe.getNodeFromJid(converse.connection.jid)),
                        'type': 'chatroom',
                        'box_id': b64_sha1(room_jid),
                        'password': $x.attr('password')
                    });
                    if (!_.contains(
                                [Strophe.Status.CONNECTING, Strophe.Status.CONNECTED],
                                chatroom.get('connection_status'))
                            ) {
                        converse.chatboxviews.get(room_jid).join();
                    }
                }
            };

            var autoJoinRooms = function () {
                _.each(converse.auto_join_rooms, function (room) {
                    if (typeof room === 'string') {
                        converse_api.rooms.open(room);
                    } else if (typeof room === 'object') {
                        converse_api.rooms.open(room.jid, room.nick);
                    } else {
                        converse.log('Invalid room criteria specified for "auto_join_rooms"', 'error');
                    }
                });
            };
            converse.on('chatBoxesFetched', autoJoinRooms);

            if (converse.allow_muc_invitations) {
                var onConnected = function () {
                    converse.connection.addHandler(
                        function (message) {
                            converse.onDirectMUCInvitation(message);
                            return true;
                        }, 'jabber:x:conference', 'message');
                };
                converse.on('connected', onConnected);
                converse.on('reconnected', onConnected);
            }
            /* ------------------------------------------------------------ */

            var _transform = function (jid, attrs, fetcher) {
                jid = jid.toLowerCase();
                return converse.wrappedChatBox(fetcher(_.extend({
                    'id': jid,
                    'jid': jid,
                    'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                    'type': 'chatroom',
                    'box_id': b64_sha1(jid)
                }, attrs)));
            };


            /* We extend the default converse.js API to add methods specific to MUC
             * chat rooms.
             */
            _.extend(converse_api, {
                'rooms': {
                    'close': function (jids) {
                        if (typeof jids === "undefined") {
                            converse.chatboxviews.each(function (view) {
                                if (view.is_chatroom && view.model) {
                                    view.close();
                                }
                            });
                        } else if (typeof jids === "string") {
                            var view = converse.chatboxviews.get(jids);
                            if (view) { view.close(); }
                        } else {
                            _.map(jids, function (jid) {
                                var view = converse.chatboxviews.get(jid);
                                if (view) { view.close(); }
                            });
                        }
                    },
                    'open': function (jids, attrs) {
                        if (typeof attrs === "string") {
                            attrs = {'nick': attrs};
                        } else if (typeof attrs === "undefined") {
                            attrs = {};
                        }
                        var fetcher = converse.chatboxviews.showChat.bind(converse.chatboxviews);
                        if (typeof jids === "undefined") {
                            throw new TypeError('rooms.open: You need to provide at least one JID');
                        } else if (typeof jids === "string") {
                            return _transform(jids, attrs, fetcher);
                        }
                        return _.map(jids, _.partial(_transform, _, attrs, fetcher));
                    },
                    'get': function (jids, attrs, create) {
                        if (typeof attrs === "string") {
                            attrs = {'nick': attrs};
                        } else if (typeof attrs === "undefined") {
                            attrs = {};
                        }
                        if (typeof jids === "undefined") {
                            var result = [];
                            converse.chatboxes.each(function (chatbox) {
                                if (chatbox.get('type') === 'chatroom') {
                                    result.push(converse.wrappedChatBox(chatbox));
                                }
                            });
                            return result;
                        }
                        var fetcher = _.partial(converse.chatboxviews.getChatBox.bind(converse.chatboxviews), _, create);
                        if (!attrs.nick) {
                            attrs.nick = Strophe.getNodeFromJid(converse.bare_jid);
                        }
                        if (typeof jids === "string") {
                            return _transform(jids, attrs, fetcher);
                        }
                        return _.map(jids, _.partial(_transform, _, attrs, fetcher));
                    }
                }
            });
        }
    });
}));
