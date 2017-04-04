// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define([
            "converse-core",
            "tpl!chatarea",
            "tpl!chatroom",
            "tpl!chatroom_features",
            "tpl!chatroom_form",
            "tpl!chatroom_head",
            "tpl!chatroom_invite",
            "tpl!chatroom_nickname_form",
            "tpl!chatroom_password_form",
            "tpl!chatroom_sidebar",
            "tpl!chatroom_toolbar",
            "tpl!chatrooms_tab",
            "tpl!info",
            "tpl!occupant",
            "tpl!room_description",
            "tpl!room_item",
            "tpl!room_panel",
            "awesomplete",
            "converse-chatview"
    ], factory);
}(this, function (
            converse,
            tpl_chatarea,
            tpl_chatroom,
            tpl_chatroom_features,
            tpl_chatroom_form,
            tpl_chatroom_head,
            tpl_chatroom_invite,
            tpl_chatroom_nickname_form,
            tpl_chatroom_password_form,
            tpl_chatroom_sidebar,
            tpl_chatroom_toolbar,
            tpl_chatrooms_tab,
            tpl_info,
            tpl_occupant,
            tpl_room_description,
            tpl_room_item,
            tpl_room_panel,
            Awesomplete
    ) {
    "use strict";
    var ROOMS_PANEL_ID = 'chatrooms';

    // Strophe methods for building stanzas
    var Strophe = converse.env.Strophe,
        $iq = converse.env.$iq,
        $build = converse.env.$build,
        $msg = converse.env.$msg,
        $pres = converse.env.$pres,
        b64_sha1 = converse.env.b64_sha1,
        sizzle = converse.env.sizzle,
        utils = converse.env.utils;
    // Other necessary globals
    var $ = converse.env.jQuery,
        _ = converse.env._,
        moment = converse.env.moment;

    // Add Strophe Namespaces
    Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
    Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
    Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
    Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
    Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");

    var ROOM_FEATURES = [
        'passwordprotected', 'unsecured', 'hidden',
        'public', 'membersonly', 'open', 'persistent',
        'temporary', 'nonanonymous', 'semianonymous',
        'moderated', 'unmoderated', 'mam_enabled'
    ];
    var ROOM_FEATURES_MAP = {
        'passwordprotected': 'unsecured',
        'unsecured': 'passwordprotected',
        'hidden': 'public',
        'public': 'hidden',
        'membersonly': 'open',
        'open': 'membersonly',
        'persistent': 'temporary',
        'temporary': 'persistent',
        'nonanonymous': 'semianonymous',
        'semianonymous': 'nonanonymous',
        'moderated': 'unmoderated',
        'unmoderated': 'moderated'
    };
    var ROOMSTATUS = {
        CONNECTED: 0,
        CONNECTING: 1,
        NICKNAME_REQUIRED: 2,
        DISCONNECTED: 3,
        ENTERED: 4
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
        optional_dependencies: ["converse-controlbox"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.addClientFeatures.apply(this, arguments);
                    if (_converse.allow_muc_invitations) {
                        _converse.connection.disco.addFeature('jabber:x:conference'); // Invites
                    }
                    if (_converse.allow_muc) {
                        _converse.connection.disco.addFeature(Strophe.NS.MUC);
                    }
                }
            },

            ControlBoxView: {
                renderContactsPanel: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.renderContactsPanel.apply(this, arguments);
                    if (_converse.allow_muc) {
                        this.roomspanel = new _converse.RoomsPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': new (Backbone.Model.extend({
                                id: b64_sha1('converse.roomspanel'+_converse.bare_jid), // Required by sessionStorage
                                browserStorage: new Backbone.BrowserStorage[_converse.storage](
                                    b64_sha1('converse.roomspanel'+_converse.bare_jid))
                            }))()
                        });
                        this.roomspanel.render().model.fetch();
                        if (!this.roomspanel.model.get('nick')) {
                            this.roomspanel.model.save({
                                nick: Strophe.getNodeFromJid(_converse.bare_jid)
                            });
                        }
                    }
                },

                onConnected: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.onConnected.apply(this, arguments);
                    if (!this.model.get('connected')) {
                        return;
                    }
                    if (_.isUndefined(_converse.muc_domain)) {
                        _converse.features.off('add', this.featureAdded, this);
                        _converse.features.on('add', this.featureAdded, this);
                        // Features could have been added before the controlbox was
                        // initialized. We're only interested in MUC
                        var feature = _converse.features.findWhere({
                            'var': Strophe.NS.MUC
                        });
                        if (feature) {
                            this.featureAdded(feature);
                        }
                    } else {
                        this.setMUCDomain(_converse.muc_domain);
                    }
                },

                setMUCDomain: function (domain) {
                    this.roomspanel.model.save({'muc_domain': domain});
                    var $server= this.$el.find('input.new-chatroom-server');
                    if (!$server.is(':focus')) {
                        $server.val(this.roomspanel.model.get('muc_domain'));
                    }
                },

                featureAdded: function (feature) {
                    var _converse = this.__super__._converse;
                    if ((feature.get('var') === Strophe.NS.MUC) && (_converse.allow_muc)) {
                        this.setMUCDomain(feature.get('from'));
                    }
                }
            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var _converse = this.__super__._converse;
                    var view = this.get(item.get('id'));
                    if (!view && item.get('type') === 'chatroom') {
                        view = new _converse.ChatRoomView({'model': item});
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
            var _converse = this._converse,
                __ = _converse.__,
                ___ = _converse.___;
            // XXX: Inside plugins, all calls to the translation machinery
            // (e.g. utils.__) should only be done in the initialize function.
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
                    332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down.")
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
                    210: ___('Your nickname has been automatically set to: %1$s'),
                    303: ___('Your nickname has been changed to: %1$s')
                }
            };

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

            _converse.createChatRoom = function (settings) {
                /* Creates a new chat room, making sure that certain attributes
                 * are correct, for example that the "type" is set to
                 * "chatroom".
                 */
                settings = _.extend(
                    _.zipObject(ROOM_FEATURES, _.map(ROOM_FEATURES, _.stubFalse)),
                    settings
                );
                return _converse.chatboxviews.showChat(
                    _.extend({
                        'affiliation': null,
                        'connection_status': ROOMSTATUS.DISCONNECTED,
                        'description': '',
                        'features_fetched': false,
                        'roomconfig': {},
                        'type': 'chatroom',
                    }, settings)
                );
            };

            _converse.ChatRoomView = _converse.ChatBoxView.extend({
                /* Backbone View which renders a chat room, based upon the view
                 * for normal one-on-one chat boxes.
                 */
                length: 300,
                tagName: 'div',
                className: 'chatbox chatroom hidden',
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
                    'keypress .chat-textarea': 'keyPressed',
                    'click .send-button': 'onSendButtonClicked'
                },

                initialize: function () {
                    var that = this;
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:connection_status', this.afterConnected, this);
                    this.model.on('change:affiliation', this.renderHeading, this);
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:description', this.renderHeading, this);
                    this.model.on('change:name', this.renderHeading, this);

                    this.createOccupantsView();
                    this.render().insertIntoDOM();
                    this.registerHandlers();

                    if (this.model.get('connection_status') !==  ROOMSTATUS.ENTERED) {
                        this.getRoomFeatures().always(function () {
                            that.join();
                            that.fetchMessages();
                            _converse.emit('chatRoomOpened', that);
                        });
                    } else {
                        this.fetchMessages();
                        _converse.emit('chatRoomOpened', that);
                    }
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                            .html(tpl_chatroom());
                    this.renderHeading();
                    this.renderChatArea();
                    utils.refreshWebkit();
                    return this;
                },

                renderHeading: function () {
                    /* Render the heading UI of the chat room. */
                    this.el.querySelector('.chat-head-chatroom').innerHTML = this.generateHeadingHTML();
                },

                renderChatArea: function () {
                    /* Render the UI container in which chat room messages will
                     * appear.
                     */
                    if (!this.$('.chat-area').length) {
                        this.$('.chatroom-body').empty()
                            .append(tpl_chatarea({
                                    'unread_msgs': __('You have unread messages'),
                                    'show_toolbar': _converse.show_toolbar,
                                    'label_message': __('Message'),
                                    'show_send_button': _converse.show_send_button
                                }))
                            .append(this.occupantsview.$el);
                        this.renderToolbar(tpl_chatroom_toolbar);
                        this.$content = this.$el.find('.chat-content');
                    }
                    this.toggleOccupants(null, true);
                    return this;
                },

                createOccupantsView: function () {
                    /* Create the ChatRoomOccupantsView Backbone.View
                     */
                    var model = new _converse.ChatRoomOccupants();
                    model.chatroomview = this;
                    this.occupantsview = new _converse.ChatRoomOccupantsView({'model': model});
                    var id = b64_sha1('converse.occupants'+_converse.bare_jid+this.model.get('jid'));
                    this.occupantsview.model.browserStorage = new Backbone.BrowserStorage.session(id);
                    this.occupantsview.render();
                    this.occupantsview.model.fetch({add:true});
                    return this;
                },

                insertIntoDOM: function () {
                    if (document.querySelector('body').contains(this.el)) {
                        return;
                    }
                    var view = _converse.chatboxviews.get("controlbox");
                    if (view) {
                        this.$el.insertAfter(view.$el);
                    } else {
                        $('#conversejs').prepend(this.$el);
                    }
                    return this;
                },

                generateHeadingHTML: function () {
                    /* Returns the heading HTML to be rendered.
                     */
                    return tpl_chatroom_head(
                        _.extend(this.model.toJSON(), {
                            info_close: __('Close and leave this room'),
                            info_configure: __('Configure this room'),
                            description: this.model.get('description') || ''
                    }));
                },

                afterShown: function () {
                    /* Override from converse-chatview, specifically to avoid
                     * the 'active' chat state from being sent out prematurely.
                     *
                     * This is instead done in `afterConnected` below.
                     */
                    if (_converse.connection.connected) {
                        // Without a connection, we haven't yet initialized
                        // localstorage
                        this.model.save();
                    }
                    this.occupantsview.setOccupantsHeight();
                },

                afterConnected: function () {
                    if (this.model.get('connection_status') === ROOMSTATUS.ENTERED) {
                        this.setChatState(_converse.ACTIVE);
                        this.scrollDown();
                        this.focus();
                    }
                },

                getExtraMessageClasses: function (attrs) {
                    var extra_classes = _converse.ChatBoxView.prototype
                            .getExtraMessageClasses.apply(this, arguments);

                    if (this.is_chatroom && attrs.sender === 'them' &&
                            (new RegExp("\\b"+this.model.get('nick')+"\\b")).test(attrs.message)
                        ) {
                        // Add special class to mark groupchat messages
                        // in which we are mentioned.
                        extra_classes += ' mentioned';
                    }
                    return extra_classes;
                },

                getToolbarOptions: function () {
                    return _.extend(
                        _converse.ChatBoxView.prototype.getToolbarOptions.apply(this, arguments),
                        {
                          label_hide_occupants: __('Hide the list of occupants'),
                          show_occupants_toggle: this.is_chatroom && _converse.visible_toolbar_buttons.toggle_occupants
                        }
                    );
                },

                close: function (ev) {
                    /* Close this chat box, which implies leaving the room as
                     * well.
                     */
                    this.leave();
                },

                toggleOccupants: function (ev, preserve_state) {
                    /* Show or hide the right sidebar containing the chat
                     * occupants (and the invite widget).
                     */
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

                requestMemberList: function (chatroom_jid, affiliation) {
                    /* Send an IQ stanza to the server, asking it for the
                     * member-list of this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (String) chatroom_jid: The JID of the chatroom for
                     *      which the member-list is being requested
                     *  (String) affiliation: The specific member list to
                     *      fetch. 'admin', 'owner' or 'member'.
                     *
                     * Returns:
                     *  A promise which resolves once the list has been
                     *  retrieved.
                     */
                    var deferred = new $.Deferred();
                    affiliation = affiliation || 'member';
                    var iq = $iq({to: chatroom_jid, type: "get"})
                        .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                            .c("item", {'affiliation': affiliation});
                    _converse.connection.sendIQ(iq, deferred.resolve, deferred.reject);
                    return deferred.promise();
                },

                parseMemberListIQ: function (iq) {
                    /* Given an IQ stanza with a member list, create an array of member
                     * objects.
                     */
                    return _.map(
                        $(iq).find('query[xmlns="'+Strophe.NS.MUC_ADMIN+'"] item'),
                        function (item) {
                            return {
                                'jid': item.getAttribute('jid'),
                                'affiliation': item.getAttribute('affiliation'),
                            };
                        }
                    );
                },

                computeAffiliationsDelta: function (exclude_existing, remove_absentees, new_list, old_list) {
                    /* Given two lists of objects with 'jid', 'affiliation' and
                     * 'reason' properties, return a new list containing
                     * those objects that are new, changed or removed
                     * (depending on the 'remove_absentees' boolean).
                     *
                     * The affiliations for new and changed members stay the
                     * same, for removed members, the affiliation is set to 'none'.
                     *
                     * The 'reason' property is not taken into account when
                     * comparing whether affiliations have been changed.
                     *
                     * Parameters:
                     *  (Boolean) exclude_existing: Indicates whether JIDs from
                     *      the new list which are also in the old list
                     *      (regardless of affiliation) should be excluded
                     *      from the delta. One reason to do this
                     *      would be when you want to add a JID only if it
                     *      doesn't have *any* existing affiliation at all.
                     *  (Boolean) remove_absentees: Indicates whether JIDs
                     *      from the old list which are not in the new list
                     *      should be considered removed and therefore be
                     *      included in the delta with affiliation set
                     *      to 'none'.
                     *  (Array) new_list: Array containing the new affiliations
                     *  (Array) old_list: Array containing the old affiliations
                     */
                    var new_jids = _.map(new_list, 'jid');
                    var old_jids = _.map(old_list, 'jid');

                    // Get the new affiliations
                    var delta = _.map(_.difference(new_jids, old_jids), function (jid) {
                        return new_list[_.indexOf(new_jids, jid)];
                    });
                    if (!exclude_existing) {
                        // Get the changed affiliations
                        delta = delta.concat(_.filter(new_list, function (item) {
                            var idx = _.indexOf(old_jids, item.jid);
                            if (idx >= 0) {
                                return item.affiliation !== old_list[idx].affiliation;
                            }
                            return false;
                        }));
                    }
                    if (remove_absentees) {
                        // Get the removed affiliations
                        delta = delta.concat(_.map(_.difference(old_jids, new_jids), function (jid) {
                            return {'jid': jid, 'affiliation': 'none'};
                        }));
                    }
                    return delta;
                },

                sendAffiliationIQ: function (chatroom_jid, affiliation, member) {
                    /* Send an IQ stanza specifying an affiliation change.
                     *
                     * Paremeters:
                     *  (String) chatroom_jid: JID of the relevant room
                     *  (String) affiliation: affiliation (could also be stored
                     *      on the member object).
                     *  (Object) member: Map containing the member's jid and
                     *      optionally a reason and affiliation.
                     */
                    var deferred = new $.Deferred();
                    var iq = $iq({to: chatroom_jid, type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                        .c("item", {
                            'affiliation': member.affiliation || affiliation,
                            'jid': member.jid
                        });
                    if (!_.isUndefined(member.reason)) {
                        iq.c("reason", member.reason);
                    }
                    _converse.connection.sendIQ(iq, deferred.resolve, deferred.reject);
                    return deferred;
                },

                setAffiliation: function (affiliation, members) {
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
                    members = _.filter(members, function (member) {
                        // We only want those members who have the right
                        // affiliation (or none, which implies the provided
                        // one).
                        return _.isUndefined(member.affiliation) ||
                                member.affiliation === affiliation;
                    });
                    var promises = _.map(
                        members,
                        _.partial(this.sendAffiliationIQ, this.model.get('jid'), affiliation)
                    );
                    return $.when.apply($, promises);
                },

                setAffiliations: function (members, onSuccess, onError) {
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
                    if (_.isEmpty(members)) {
                        // Succesfully updated with zero affilations :)
                        onSuccess(null);
                        return;
                    }
                    var affiliations = _.uniq(_.map(members, 'affiliation'));
                    var promises = _.map(affiliations, _.partial(this.setAffiliation.bind(this), _, members));
                    $.when.apply($, promises).done(onSuccess).fail(onError);
                },

                marshallAffiliationIQs: function () {
                    /* Marshall a list of IQ stanzas into a map of JIDs and
                     * affiliations.
                     *
                     * Parameters:
                     *  Any amount of XMLElement objects, representing the IQ
                     *  stanzas.
                     */
                    return _.flatMap(arguments, this.parseMemberListIQ);
                },

                getJidsWithAffiliations: function (affiliations) {
                    /* Returns a map of JIDs that have the affiliations
                     * as provided.
                     */
                    if (_.isString(affiliations)) {
                        affiliations = [affiliations];
                    }
                    var deferred = new $.Deferred();
                    var promises = _.map(affiliations, _.partial(this.requestMemberList, this.model.get('jid')));
                    $.when.apply($, promises).always(
                        _.flow(this.marshallAffiliationIQs.bind(this), deferred.resolve)
                    );
                    return deferred.promise();
                },

                updateMemberLists: function (members, affiliations, deltaFunc) {
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
                    var that = this;
                    var deferred = new $.Deferred();
                    this.getJidsWithAffiliations(affiliations).then(function (old_members) {
                        that.setAffiliations(
                            deltaFunc(members, old_members),
                            deferred.resolve,
                            deferred.reject
                        );
                    });
                    return deferred.promise();
                },

                directInvite: function (recipient, reason) {
                    /* Send a direct invitation as per XEP-0249
                     *
                     * Parameters:
                     *    (String) recipient - JID of the person being invited
                     *    (String) reason - Optional reason for the invitation
                     */
                    if (this.model.get('membersonly')) {
                        // When inviting to a members-only room, we first add
                        // the person to the member list by giving them an
                        // affiliation of 'member' (if they're not affiliated
                        // already), otherwise they won't be able to join.
                        var map = {}; map[recipient] = 'member';
                        var deltaFunc = _.partial(this.computeAffiliationsDelta, true, false);
                        this.updateMemberLists(
                            [{'jid': recipient, 'affiliation': 'member', 'reason': reason}],
                            ['member', 'owner', 'admin'],
                            deltaFunc
                        );
                    }
                    var attrs = {
                        'xmlns': 'jabber:x:conference',
                        'jid': this.model.get('jid')
                    };
                    if (reason !== null) { attrs.reason = reason; }
                    if (this.model.get('password')) { attrs.password = this.model.get('password'); }
                    var invitation = $msg({
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
                    if (message.get('chat_state') !== _converse.GONE) {
                        _converse.ChatBoxView.prototype.handleChatStateMessage.apply(this, arguments);
                    }
                },

                sendChatState: function () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    if (this.model.get('connection_status') !==  ROOMSTATUS.ENTERED) {
                        return;
                    }
                    var chat_state = this.model.get('chat_state');
                    if (chat_state === _converse.GONE) {
                        // <gone/> is not applicable within MUC context
                        return;
                    }
                    _converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'groupchat'})
                            .c(chat_state, {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                sendChatRoomMessage: function (text) {
                    /* Constuct a message stanza to be sent to this chat room,
                     * and send it to the server.
                     *
                     * Parameters:
                     *  (String) text: The message text to be sent.
                     */
                    var msgid = _converse.connection.getUniqueId();
                    var msg = $msg({
                        to: this.model.get('jid'),
                        from: _converse.connection.jid,
                        type: 'groupchat',
                        id: msgid
                    }).c("body").t(text).up()
                    .c("x", {xmlns: "jabber:x:event"}).c(_converse.COMPOSING);
                    _converse.connection.send(msg);
                    this.model.messages.create({
                        fullname: this.model.get('nick'),
                        sender: 'me',
                        time: moment().format(),
                        message: text,
                        msgid: msgid
                    });
                },

                modifyRole: function(room, nick, role, reason, onSuccess, onError) {
                    var item = $build("item", {nick: nick, role: role});
                    var iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                    if (reason !== null) { iq.c("reason", reason); }
                    return _converse.connection.sendIQ(iq.tree(), onSuccess, onError);
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
                    /* Remove all messages from the chat room UI.
                     */
                    if (!_.isUndefined(ev)) { ev.stopPropagation(); }
                    var result = confirm(__("Are you sure you want to clear the messages from this room?"));
                    if (result === true) {
                        this.$content.empty();
                    }
                    return this;
                },

                onCommandError: function () {
                    this.showStatusNotification(__("Error: could not execute the command"), true);
                },

                onMessageSubmitted: function (text) {
                    /* Gets called when the user presses enter to send off a
                     * message in a chat room.
                     *
                     * Parameters:
                     *    (String) text - The message text.
                     */
                    if (_converse.muc_disable_moderator_commands) {
                        return this.sendChatRoomMessage(text);
                    }
                    var match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''],
                        args = match[2] && match[2].splitOnce(' ') || [],
                        command = match[1].toLowerCase();
                    switch (command) {
                        case 'admin':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('admin',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'ban':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('outcast',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'clear':
                            this.clearChatRoomMessages();
                            break;
                        case 'deop':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'help':
                            this.showHelpMessages([
                                '<strong>/admin</strong>: '   +__("Change user's affiliation to admin"),
                                '<strong>/ban</strong>: '     +__('Ban user from room'),
                                '<strong>/clear</strong>: '   +__('Remove messages'),
                                '<strong>/deop</strong>: '    +__('Change user role to occupant'),
                                '<strong>/help</strong>: '    +__('Show this menu'),
                                '<strong>/kick</strong>: '    +__('Kick user from room'),
                                '<strong>/me</strong>: '      +__('Write in 3rd person'),
                                '<strong>/member</strong>: '  +__('Grant membership to a user'),
                                '<strong>/mute</strong>: '    +__("Remove user's ability to post messages"),
                                '<strong>/nick</strong>: '    +__('Change your nickname'),
                                '<strong>/op</strong>: '      +__('Grant moderator role to user'),
                                '<strong>/owner</strong>: '   +__('Grant ownership of this room'),
                                '<strong>/revoke</strong>: '  +__("Revoke user's membership"),
                                '<strong>/subject</strong>: ' +__('Set room subject'),
                                '<strong>/topic</strong>: '   +__('Set room subject (alias for /subject)'),
                                '<strong>/voice</strong>: '   +__('Allow muted user to post messages')
                            ]);
                            break;
                        case 'kick':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'none', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'mute':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'visitor', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'member':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('member',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'nick':
                            _converse.connection.send($pres({
                                from: _converse.connection.jid,
                                to: this.getRoomJIDAndNick(match[2]),
                                id: _converse.connection.getUniqueId()
                            }).tree());
                            break;
                        case 'owner':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('owner',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'op':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'moderator', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'revoke':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('none',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'topic':
                        case 'subject':
                            _converse.connection.send(
                                $msg({
                                    to: this.model.get('jid'),
                                    from: _converse.connection.jid,
                                    type: "groupchat"
                                }).c("subject", {xmlns: "jabber:client"}).t(match[2]).tree()
                            );
                            break;
                        case 'voice':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        default:
                            this.sendChatRoomMessage(text);
                        break;
                    }
                },

                handleMUCMessage: function (stanza) {
                    /* Handler for all MUC messages sent to this chat room.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message stanza.
                     */
                    var configuration_changed = stanza.querySelector("status[code='104']");
                    var logging_enabled = stanza.querySelector("status[code='170']");
                    var logging_disabled = stanza.querySelector("status[code='171']");
                    var room_no_longer_anon = stanza.querySelector("status[code='172']");
                    var room_now_semi_anon = stanza.querySelector("status[code='173']");
                    var room_now_fully_anon = stanza.querySelector("status[code='173']");
                    if (configuration_changed || logging_enabled || logging_disabled ||
                            room_no_longer_anon || room_now_semi_anon || room_now_fully_anon) {
                        this.getRoomFeatures();
                    }
                    _.flow(this.showStatusMessages.bind(this), this.onChatRoomMessage.bind(this))(stanza);
                    return true;
                },

                getRoomJIDAndNick: function (nick) {
                    /* Utility method to construct the JID for the current user
                     * as occupant of the room.
                     *
                     * This is the room JID, with the user's nick added at the
                     * end.
                     *
                     * For example: room@conference.example.org/nickname
                     */
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

                registerHandlers: function () {
                    /* Register presence and message handlers for this chat
                     * room
                     */
                    var room_jid = this.model.get('jid');
                    this.removeHandlers();
                    this.presence_handler = _converse.connection.addHandler(
                        this.onChatRoomPresence.bind(this),
                        Strophe.NS.MUC, 'presence', null, null, room_jid,
                        {'ignoreNamespaceFragment': true, 'matchBareFromJid': true}
                    );
                    this.message_handler = _converse.connection.addHandler(
                        this.handleMUCMessage.bind(this),
                        null, 'message', null, null, room_jid,
                        {'matchBareFromJid': true}
                    );
                },

                removeHandlers: function () {
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

                join: function (nick, password) {
                    /* Join the chat room.
                     *
                     * Parameters:
                     *  (String) nick: The user's nickname
                     *  (String) password: Optional password, if required by
                     *      the room.
                     */
                    nick = nick ? nick : this.model.get('nick');
                    if (!nick) {
                        return this.checkForReservedNick();
                    }
                    if (this.model.get('connection_status') === ROOMSTATUS.ENTERED) {
                        // We have restored a chat room from session storage,
                        // so we don't send out a presence stanza again.
                        return this;
                    }
                    var stanza = $pres({
                        'from': _converse.connection.jid,
                        'to': this.getRoomJIDAndNick(nick)
                    }).c("x", {'xmlns': Strophe.NS.MUC})
                      .c("history", {'maxstanzas': _converse.muc_history_max_stanzas}).up();
                    if (password) {
                        stanza.cnode(Strophe.xmlElement("password", [], password));
                    }
                    this.model.save('connection_status', ROOMSTATUS.CONNECTING);
                    _converse.connection.send(stanza);
                    return this;
                },

                cleanup: function () {
                    this.model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                    this.removeHandlers();
                    _converse.ChatBoxView.prototype.close.apply(this, arguments);
                },

                leave: function(exit_msg) {
                    /* Leave the chat room.
                     *
                     * Parameters:
                     *  (String) exit_msg: Optional message to indicate your
                     *      reason for leaving.
                     */
                    this.hide();
                    this.occupantsview.model.reset();
                    this.occupantsview.model.browserStorage._clear();
                    if (!_converse.connection.connected ||
                            this.model.get('connection_status') === ROOMSTATUS.DISCONNECTED) {
                        // Don't send out a stanza if we're not connected.
                        this.cleanup();
                        return;
                    }
                    var presence = $pres({
                        type: "unavailable",
                        from: _converse.connection.jid,
                        to: this.getRoomJIDAndNick()
                    });
                    if (exit_msg !== null) {
                        presence.c("status", exit_msg);
                    }
                    _converse.connection.sendPresence(
                        presence,
                        this.cleanup.bind(this),
                        this.cleanup.bind(this),
                        2000
                    );
                },

                renderConfigurationForm: function (stanza) {
                    /* Renders a form given an IQ stanza containing the current
                     * room configuration.
                     *
                     * Returns a promise which resolves once the user has
                     * either submitted the form, or canceled it.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The IQ stanza containing the room config.
                     */
                    var that = this,
                        $body = this.$('.chatroom-body');
                    $body.children().addClass('hidden');
                    // Remove any existing forms
                    $body.find('form.chatroom-form').remove();
                    $body.append(tpl_chatroom_form());

                    var $form = $body.find('form.chatroom-form'),
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
                    $fieldset.find('input[type=button]').on('click', function (ev) {
                        ev.preventDefault();
                        that.cancelConfiguration();
                    });
                    $form.on('submit', function (ev) {
                        ev.preventDefault();
                        that.saveConfiguration(ev.target);
                    });
                },

                sendConfiguration: function(config, onSuccess, onError) {
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
                    var iq = $iq({to: this.model.get('jid'), type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                        .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                    _.each(config || [], function (node) { iq.cnode(node).up(); });
                    onSuccess = _.isUndefined(onSuccess) ? _.noop : _.partial(onSuccess, iq.nodeTree);
                    onError = _.isUndefined(onError) ? _.noop : _.partial(onError, iq.nodeTree);
                    return _converse.connection.sendIQ(iq, onSuccess, onError);
                },

                saveConfiguration: function (form) {
                    /* Submit the room configuration form by sending an IQ
                     * stanza to the server.
                     *
                     * Returns a promise which resolves once the XMPP server
                     * has return a response IQ.
                     *
                     * Parameters:
                     *  (HTMLElement) form: The configuration form DOM element.
                     */
                    var deferred = new $.Deferred();
                    var that = this;
                    var $inputs = $(form).find(':input:not([type=button]):not([type=submit])'),
                        configArray = [];
                    $inputs.each(function () {
                        configArray.push(utils.webForm2xForm(this));
                    });
                    this.sendConfiguration(
                        configArray,
                        deferred.resolve,
                        deferred.reject
                    );
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.renderAfterTransition();
                        });
                    return deferred.promise();
                },

                autoConfigureChatRoom: function (stanza) {
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
                    var that = this, configArray = [],
                        $fields = $(stanza).find('field'),
                        count = $fields.length,
                        config = this.model.get('roomconfig');

                    $fields.each(function () {
                        var fieldname = this.getAttribute('var').replace('muc#roomconfig_', ''),
                            type = this.getAttribute('type'),
                            value;
                        if (fieldname in config) {
                            switch (type) {
                                case 'boolean':
                                    value = config[fieldname] ? 1 : 0;
                                    break;
                                case 'list-multi':
                                    // TODO: we don't yet handle "list-multi" types
                                    value = this.innerHTML;
                                    break;
                                default:
                                    value = config[fieldname];
                            }
                            this.innerHTML = $build('value').t(value);
                        }
                        configArray.push(this);
                        if (!--count) {
                            that.sendConfiguration(configArray);
                        }
                    });
                },

                cancelConfiguration: function () {
                    /* Remove the configuration form without submitting and
                     * return to the chat view.
                     */
                    var that = this;
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.renderAfterTransition();
                        });
                },

                fetchRoomConfiguration: function (handler) {
                    /* Send an IQ stanza to fetch the room configuration data.
                     * Returns a promise which resolves once the response IQ
                     * has been received.
                     *
                     * Parameters:
                     *  (Function) handler: The handler for the response IQ
                     */
                    var that = this;
                    var deferred = new $.Deferred();
                    _converse.connection.sendIQ(
                        $iq({
                            'to': this.model.get('jid'),
                            'type': "get"
                        }).c("query", {xmlns: Strophe.NS.MUC_OWNER}),
                        function (iq) {
                            if (handler) {
                                handler.apply(that, arguments);
                            }
                            deferred.resolve(iq);
                        },
                        deferred.reject // errback
                    );
                    return deferred.promise();
                },

                getRoomFeatures: function () {
                    /* Fetch the room disco info, parse it and then
                     * save it on the Backbone.Model of this chat rooms.
                     */
                    var deferred = new $.Deferred();
                    var that = this;
                    _converse.connection.disco.info(this.model.get('jid'), null,
                        function (iq) {
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
                            var features = {
                                'features_fetched': true
                            };
                            _.each(iq.querySelectorAll('feature'), function (field) {
                                var fieldname = field.getAttribute('var');
                                if (!fieldname.startsWith('muc_')) {
                                    if (fieldname === Strophe.NS.MAM) {
                                        features.mam_enabled = true;
                                    }
                                    return;
                                }
                                features[fieldname.replace('muc_', '')] = true;
                            });
                            var desc_field = iq.querySelector('field[var="muc#roominfo_description"] value');
                            if (!_.isNull(desc_field)) {
                                features.description = desc_field.textContent;
                            }
                            that.model.save(features);
                            return deferred.resolve();
                        },
                        deferred.reject,
                        5000
                    );
                    return deferred.promise();
                },

                configureChatRoom: function (ev) {
                    /* Start the process of configuring a chat room, either by
                     * rendering a configuration form, or by auto-configuring
                     * based on the "roomconfig" data stored on the
                     * Backbone.Model.
                     *
                     * Stores the new configuration on the Backbone.Model once
                     * completed.
                     *
                     * Paremeters:
                     *  (Event) ev: DOM event that might be passed in if this
                     *      method is called due to a user action. In this
                     *      case, auto-configure won't happen, regardless of
                     *      the settings.
                     */
                    if (_.isUndefined(ev) && this.model.get('auto_configure')) {
                        this.fetchRoomConfiguration().then(
                            this.autoConfigureChatRoom.bind(this));
                    } else {
                        if (!_.isUndefined(ev) && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        this.showSpinner();
                        this.fetchRoomConfiguration().then(
                            this.renderConfigurationForm.bind(this));
                    }
                },

                submitNickname: function (ev) {
                    /* Get the nickname value from the form and then join the
                     * chat room with it.
                     */
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
                    this.$el.find('.chatroom-form-container')
                            .replaceWith('<span class="spinner centered"/>');
                    this.join(nick);
                },

                checkForReservedNick: function () {
                    /* User service-discovery to ask the XMPP server whether
                     * this user has a reserved nickname for this room.
                     * If so, we'll use that, otherwise we render the nickname
                     * form.
                     */
                    this.showSpinner();
                    _converse.connection.sendIQ(
                        $iq({
                            'to': this.model.get('jid'),
                            'from': _converse.connection.jid,
                            'type': "get"
                        }).c("query", {
                            'xmlns': Strophe.NS.DISCO_INFO,
                            'node': 'x-roomuser-item'
                        }),
                        this.onNickNameFound.bind(this),
                        this.onNickNameNotFound.bind(this)
                    );
                    return this;
                },

                onNickNameFound: function (iq) {
                    /* We've received an IQ response from the server which
                     * might contain the user's reserved nickname.
                     * If no nickname is found we either render a form for
                     * them to specify one, or we try to join the room with the
                     * node of the user's JID.
                     *
                     * Parameters:
                     *  (XMLElement) iq: The received IQ stanza
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
                    if (_converse.muc_nickname_from_jid) {
                        // We try to enter the room with the node part of
                        // the user's JID.
                        this.join(Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.bare_jid)));
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
                    return Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.bare_jid));
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
                    if (_converse.muc_nickname_from_jid) {
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
                            __("The nickname you chose is reserved or "+
                               "currently in use, please choose a different one.")
                        );
                    }
                },

                renderNicknameForm: function (message) {
                    /* Render a form which allows the user to choose their
                     * nickname.
                     */
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    if (!_.isString(message)) {
                        message = '';
                    }
                    this.$('.chatroom-body').append(
                        tpl_chatroom_nickname_form({
                            heading: __('Please choose your nickname'),
                            label_nickname: __('Nickname'),
                            label_join: __('Enter room'),
                            validation_message: message
                        }));
                    this.model.save('connection_status', ROOMSTATUS.NICKNAME_REQUIRED);
                    this.$('.chatroom-form').on('submit', this.submitNickname.bind(this));
                },

                submitPassword: function (ev) {
                    ev.preventDefault();
                    var password = this.$el.find('.chatroom-form').find('input[type=password]').val();
                    this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                    this.join(this.model.get('nick'), password);
                },

                renderPasswordForm: function () {
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append(
                        tpl_chatroom_password_form({
                            heading: __('This chatroom requires a password'),
                            label_password: __('Password: '),
                            label_submit: __('Submit')
                        }));
                    this.$('.chatroom-form').on('submit', this.submitPassword.bind(this));
                },

                showDisconnectMessage: function (msg) {
                    this.$('.chat-area').addClass('hidden');
                    this.$('.occupants').addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append($('<p>'+msg+'</p>'));
                },

                getMessageFromStatus: function (stat, stanza, is_self) {
                    /* Parameters:
                     *  (XMLElement) stat: A <status> element.
                     *  (Boolean) is_self: Whether the element refers to the
                     *                     current user.
                     *  (XMLElement) stanza: The original stanza received.
                     */
                    var code = stat.getAttribute('code'), nick;
                    if (code === '110') { return; }
                    if (code in _converse.muc.info_messages) {
                        return _converse.muc.info_messages[code];
                    }
                    if (!is_self) {
                        if (code in _converse.muc.action_info_messages) {
                            nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                            return __(_converse.muc.action_info_messages[code], nick);
                        }
                    } else if (code in _converse.muc.new_nickname_messages) {
                        if (is_self && code === "210") {
                            nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                        } else if (is_self && code === "303") {
                            nick = stanza.querySelector('x item').getAttribute('nick');
                        }
                        return __(_converse.muc.new_nickname_messages[code], nick);
                    }
                    return;
                },

                saveAffiliationAndRole: function (pres) {
                    /* Parse the presence stanza for the current user's
                     * affiliation.
                     *
                     * Parameters:
                     *  (XMLElement) pres: A <presence> stanza.
                     */
                    var item = sizzle('x[xmlns="'+Strophe.NS.MUC_USER+'"] item', pres).pop();
                    if (_.isNil(item)) { return; }
                    var jid = item.getAttribute('jid');
                    if (Strophe.getBareJidFromJid(jid) === _converse.bare_jid) {
                        var affiliation = item.getAttribute('affiliation');
                        var role = item.getAttribute('role');
                        if (affiliation) {
                            this.model.save({'affiliation': affiliation});
                        }
                        if (role) {
                            this.model.save({'role': role});
                        }
                    }
                },

                parseXUserElement: function (x, stanza, is_self) {
                    /* Parse the passed-in <x xmlns='http://jabber.org/protocol/muc#user'>
                     * element and construct a map containing relevant
                     * information.
                     */
                    // 1. Get notification messages based on the <status> elements.
                    var statuses = x.querySelectorAll('status');
                    var mapper = _.partial(this.getMessageFromStatus, _, stanza, is_self);
                    var notification = {};
                    var messages = _.reject(_.map(statuses, mapper), _.isUndefined);
                    if (messages.length) {
                        notification.messages = messages;
                    }
                    // 2. Get disconnection messages based on the <status> elements
                    var codes = _.invokeMap(statuses, Element.prototype.getAttribute, 'code');
                    var disconnection_codes = _.intersection(codes, _.keys(_converse.muc.disconnect_messages));
                    var disconnected = is_self && disconnection_codes.length > 0;
                    if (disconnected) {
                        notification.disconnected = true;
                        notification.disconnection_message = _converse.muc.disconnect_messages[disconnection_codes[0]];
                    }
                    // 3. Find the reason and actor from the <item> element
                    var item = x.querySelector('item');
                    // By using querySelector above, we assume here there is
                    // one <item> per <x xmlns='http://jabber.org/protocol/muc#user'>
                    // element. This appears to be a safe assumption, since
                    // each <x/> element pertains to a single user.
                    if (!_.isNull(item)) {
                        var reason = item.querySelector('reason');
                        if (reason) {
                            notification.reason = reason ? reason.textContent : undefined;
                        }
                        var actor = item.querySelector('actor');
                        if (actor) {
                            notification.actor = actor ? actor.getAttribute('nick') : undefined;
                        }
                    }
                    return notification;
                },

                displayNotificationsforUser: function (notification) {
                    /* Given the notification object generated by
                     * parseXUserElement, display any relevant messages and
                     * information to the user.
                     */
                    var that = this;
                    if (notification.disconnected) {
                        this.showDisconnectMessage(notification.disconnection_message);
                        if (notification.actor) {
                            this.showDisconnectMessage(__(___('This action was done by %1$s.'), notification.actor));
                        }
                        if (notification.reason) {
                            this.showDisconnectMessage(__(___('The reason given is: "%1$s".'), notification.reason));
                        }
                        this.model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                        return;
                    }
                    _.each(notification.messages, function (message) {
                        that.$content.append(tpl_info({'message': message}));
                    });
                    if (notification.reason) {
                        this.showStatusNotification(__('The reason given is: "'+notification.reason+'"'), true);
                    }
                    if (notification.messages.length) {
                        this.scrollDown();
                    }
                },

                getJoinLeaveMessages: function (stanza) {
                    /* Parse the given stanza and return notification messages
                     * for join/leave events.
                     */
                    // XXX: some mangling required to make the returned
                    // result look like the structure returned by
                    // parseXUserElement. Not nice...
                    var nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                    var stat = stanza.querySelector('status');
                    if (stanza.getAttribute('type') === 'unavailable') {
                        if (!_.isNull(stat) && stat.textContent) {
                            return [{'messages': [__(nick+' has left the room. "'+stat.textContent+'"')]}];
                        } else {
                            return [{'messages': [__(nick+' has left the room')]}];
                        }
                    }
                    if (!this.occupantsview.model.find({'nick': nick})) {
                        // Only show join message if we don't already have the
                        // occupant model. Doing so avoids showing duplicate
                        // join messages.
                        if (!_.isNull(stat) && stat.textContent) {
                            return [{'messages': [__(nick+' has joined the room. "'+stat.textContent+'"')]}];
                        } else {
                            return [{'messages': [__(nick+' has joined the room.')]}];
                        }
                    }
                },

                showStatusMessages: function (stanza) {
                    /* Check for status codes and communicate their purpose to the user.
                     * See: http://xmpp.org/registrar/mucstatus.html
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message or presence stanza
                     *      containing the status codes.
                     */
                    var elements = sizzle('x[xmlns="'+Strophe.NS.MUC_USER+'"]', stanza);
                    var is_self = stanza.querySelectorAll("status[code='110']").length;
                    var iteratee = _.partial(this.parseXUserElement.bind(this), _, stanza, is_self);
                    var notifications = _.reject(_.map(elements, iteratee), _.isEmpty);
                    if (_.isEmpty(notifications) &&
                            _converse.muc_show_join_leave &&
                            stanza.nodeName === 'presence' &&
                            this.model.get('connection_status') === ROOMSTATUS.ENTERED
                        ) {
                        notifications = this.getJoinLeaveMessages(stanza);
                    }
                    _.each(notifications, this.displayNotificationsforUser.bind(this));
                    return stanza;
                },

                showErrorMessage: function (presence) {
                    // We didn't enter the room, so we must remove it from the MUC add-on
                    var error = presence.querySelector('error');
                    if (error.getAttribute('type') === 'auth') {
                        if (!_.isNull(error.querySelector('not-authorized'))) {
                            this.renderPasswordForm();
                        } else if (!_.isNull(error.querySelector('registration-required'))) {
                            this.showDisconnectMessage(__('You are not on the member list of this room'));
                        } else if (!_.isNull(error.querySelector('forbidden'))) {
                            this.showDisconnectMessage(__('You have been banned from this room'));
                        }
                    } else if (error.getAttribute('type') === 'modify') {
                        if (!_.isNull(error.querySelector('jid-malformed'))) {
                            this.showDisconnectMessage(__('No nickname was specified'));
                        }
                    } else if (error.getAttribute('type') === 'cancel') {
                        if (!_.isNull(error.querySelector('not-allowed'))) {
                            this.showDisconnectMessage(__('You are not allowed to create new rooms'));
                        } else if (!_.isNull(error.querySelector('not-acceptable'))) {
                            this.showDisconnectMessage(__("Your nickname doesn't conform to this room's policies"));
                        } else if (!_.isNull(error.querySelector('conflict'))) {
                            this.onNicknameClash(presence);
                        } else if (!_.isNull(error.querySelector('item-not-found'))) {
                            this.showDisconnectMessage(__("This room does not (yet) exist"));
                        } else if (!_.isNull(error.querySelector('service-unavailable'))) {
                            this.showDisconnectMessage(__("This room has reached its maximum number of occupants"));
                        }
                    }
                },

                showSpinner: function () {
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$el.find('.chatroom-body').prepend('<span class="spinner centered"/>');
                },

                renderAfterTransition: function () {
                    /* Rerender the room after some kind of transition. For
                     * example after the spinner has been removed or after a
                     * form has been submitted and removed.
                     */
                    if (this.model.get('connection_status') == ROOMSTATUS.NICKNAME_REQUIRED) {
                        this.renderNicknameForm();
                    } else {
                        this.$el.find('.chat-area').removeClass('hidden');
                        this.$el.find('.occupants').removeClass('hidden');
                        this.occupantsview.setOccupantsHeight();
                        this.scrollDown();
                    }
                },

                hideSpinner: function () {
                    /* Check if the spinner is being shown and if so, hide it.
                     * Also make sure then that the chat area and occupants
                     * list are both visible.
                     */
                    var spinner = this.el.querySelector('.spinner');
                    if (!_.isNull(spinner)) {
                        spinner.parentNode.removeChild(spinner);
                        this.renderAfterTransition();
                    }
                    return this;
                },

                createInstantRoom: function () {
                    /* Sends an empty IQ config stanza to inform the server that the
                     * room should be created with its default configuration.
                     *
                     * See http://xmpp.org/extensions/xep-0045.html#createroom-instant
                     */
                    this.saveConfiguration().then(this.getRoomFeatures.bind(this));
                },

                onChatRoomPresence: function (pres) {
                    /* Handles all MUC presence stanzas.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The stanza
                     */
                    if (pres.getAttribute('type') === 'error') {
                        this.model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                        this.showErrorMessage(pres);
                        return true;
                    }
                    var is_self = pres.querySelector("status[code='110']");
                    var locked_room = pres.querySelector("status[code='201']");
                    if (is_self) {
                        this.saveAffiliationAndRole(pres);
                        if (locked_room) {
                            // This is a new room. It will now be configured
                            // and the configuration cached on the Backbone.Model.
                            if (_converse.muc_instant_rooms) {
                                this.createInstantRoom(); // Accept default configuration
                            } else {
                                this.configureChatRoom();
                                if (!this.model.get('auto_configure')) {
                                    return;
                                }
                            }
                        }
                        this.model.save('connection_status', ROOMSTATUS.ENTERED);
                    }
                    if (!locked_room && !this.model.get('features_fetched') &&
                            this.model.get('connection_status') !== ROOMSTATUS.CONNECTED) {
                        // The features for this room weren't fetched yet, perhaps
                        // because it's a new room without locking (in which
                        // case Prosody doesn't send a 201 status).
                        // This is the first presence received for the room,
                        // so a good time to fetch the features.
                        this.getRoomFeatures();
                    }
                    this.hideSpinner().showStatusMessages(pres);
                    // This must be called after showStatusMessages so that
                    // "join" messages are correctly shown.
                    this.occupantsview.updateOccupantsOnPresence(pres);
                    if (this.model.get('role') !== 'none' &&
                            this.model.get('connection_status') === ROOMSTATUS.CONNECTING) {
                        this.model.save('connection_status', ROOMSTATUS.CONNECTED);
                    }
                    return true;
                },

                setChatRoomSubject: function (sender, subject) {
                    // For translators: the %1$s and %2$s parts will get
                    // replaced by the user and topic text respectively
                    // Example: Topic set by JC Brand to: Hello World!
                    this.$content.append(
                        tpl_info({'message': __('Topic set by %1$s to: %2$s', sender, subject)}));
                    this.scrollDown();
                },

                onChatRoomMessage: function (message) {
                    /* Given a <message> stanza, create a message
                     * Backbone.Model if appropriate.
                     *
                     * Parameters:
                     *  (XMLElement) msg: The received message stanza
                     */
                    var original_stanza = message,
                        forwarded = message.querySelector('forwarded'),
                        delay;
                    if (!_.isNull(forwarded)) {
                        message = forwarded.querySelector('message');
                        delay = forwarded.querySelector('delay');
                    }
                    var jid = message.getAttribute('from'),
                        msgid = message.getAttribute('id'),
                        resource = Strophe.getResourceFromJid(jid),
                        sender = resource && Strophe.unescapeNode(resource) || '',
                        subject = _.propertyOf(message.querySelector('subject'))('textContent'),
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
                    this.model.createMessage(message, delay, original_stanza);
                    if (sender !== this.model.get('nick')) {
                        // We only emit an event if it's not our own message
                        _converse.emit('message', original_stanza);
                    }
                    return true;
                }
            });

            _converse.ChatRoomOccupant = Backbone.Model.extend({
                initialize: function (attributes) {
                    this.set(_.extend({
                        'id': _converse.connection.getUniqueId(),
                    }, attributes));
                }
            });

            _converse.ChatRoomOccupantView = Backbone.View.extend({
                tagName: 'li',
                initialize: function () {
                    this.model.on('change', this.render, this);
                    this.model.on('destroy', this.destroy, this);
                },

                render: function () {
                    var show = this.model.get('show') || 'online';
                    var new_el = tpl_occupant(
                        _.extend(
                            { 'jid': '',
                              'show': show,
                              'hint_show': _converse.PRETTY_CHAT_STATUS[show],
                              'hint_occupant': __('Click to mention '+this.model.get('nick')+' in your message.'),
                              'desc_moderator': __('This user is a moderator.'),
                              'desc_occupant': __('This user can send messages in this room.'),
                              'desc_visitor': __('This user can NOT send messages in this room.')
                            }, this.model.toJSON()
                        )
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

            _converse.ChatRoomOccupants = Backbone.Collection.extend({
                model: _converse.ChatRoomOccupant
            });

            _converse.ChatRoomOccupantsView = Backbone.Overview.extend({
                tagName: 'div',
                className: 'occupants',

                initialize: function () {
                    this.model.on("add", this.onOccupantAdded, this);
                    this.chatroomview = this.model.chatroomview;
                    this.chatroomview.model.on('change:open', this.renderInviteWidget, this);
                    this.chatroomview.model.on('change:affiliation', this.renderInviteWidget, this);
                    this.chatroomview.model.on('change:hidden', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:mam_enabled', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:membersonly', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:moderated', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:nonanonymous', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:open', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:passwordprotected', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:persistent', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:public', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:semianonymous', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:temporary', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:unmoderated', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:unsecured', this.onFeatureChanged, this);
                },

                render: function () {
                    this.$el.html(
                        tpl_chatroom_sidebar(
                            _.extend(this.chatroomview.model.toJSON(), {
                                'allow_muc_invitations': _converse.allow_muc_invitations,
                                'label_occupants': __('Occupants')
                            }))
                    );
                    if (_converse.allow_muc_invitations) {
                        _converse.api.waitUntil('rosterContactsFetched').then(
                            this.renderInviteWidget.bind(this)
                        );
                    }
                    return this.renderRoomFeatures();
                },

                renderInviteWidget: function () {
                    var form = this.el.querySelector('form.room-invite');
                    if (this.shouldInviteWidgetBeShown()) {
                        if (_.isNull(form)) {
                            var heading = this.el.querySelector('.occupants-heading');
                            form = tpl_chatroom_invite({
                                'label_invitation': __('Invite'),
                            });
                            heading.insertAdjacentHTML('afterend', form);
                            this.initInviteWidget();
                        }
                    } else {
                        if (!_.isNull(form)) {
                            form.remove();
                        }
                    }
                    return this;
                },

                renderRoomFeatures: function () {
                    var picks = _.pick(this.chatroomview.model.attributes, ROOM_FEATURES),
                        iteratee = function (a, v) { return a || v; },
                        el = this.el.querySelector('.chatroom-features');

                    el.innerHTML = tpl_chatroom_features(
                            _.extend(this.chatroomview.model.toJSON(), {
                                'has_features': _.reduce(_.values(picks), iteratee),
                                'label_features': __('Features'),
                                'label_hidden': __('Hidden'),
                                'label_mam_enabled': __('Message archiving'),
                                'label_membersonly': __('Members only'),
                                'label_moderated': __('Moderated'),
                                'label_nonanonymous': __('Non-anonymous'),
                                'label_open': __('Open'),
                                'label_passwordprotected': __('Password protected'),
                                'label_persistent': __('Persistent'),
                                'label_public': __('Public'),
                                'label_semianonymous': __('Semi-anonymous'),
                                'label_temporary': __('Temporary'),
                                'label_unmoderated': __('Unmoderated'),
                                'label_unsecured': __('Unsecured'),
                                'tt_hidden': __('This room is not publicly searchable'),
                                'tt_mam_enabled': __('Messages are archived on the server'),
                                'tt_membersonly': __('This room is restricted to members only'),
                                'tt_moderated': __('This room is being moderated'),
                                'tt_nonanonymous': __('All other room occupants can see your Jabber ID'),
                                'tt_open': __('Anyone can join this room'),
                                'tt_passwordprotected': __('This room requires a password before entry'),
                                'tt_persistent': __('This room persists even if it\'s unoccupied'),
                                'tt_public': __('This room is publicly searchable'),
                                'tt_semianonymous': __('Only moderators can see your Jabber ID'),
                                'tt_temporary': __('This room will disappear once the last person leaves'),
                                'tt_unmoderated': __('This room is not being moderated'),
                                'tt_unsecured': __('This room does not require a password upon entry')
                            }));
                    this.setOccupantsHeight();
                    return this;
                },

                onFeatureChanged: function (model) {
                    /* When a feature has been changed, it's logical opposite
                     * must be set to the opposite value.
                     *
                     * So for example, if "temporary" was set to "false", then
                     * "persistent" will be set to "true" in this method.
                     *
                     * Additionally a debounced render method is called to make
                     * sure the features widget gets updated.
                     */
                    if (_.isUndefined(this.debouncedRenderRoomFeatures)) {
                        this.debouncedRenderRoomFeatures = _.debounce(
                            this.renderRoomFeatures, 100, {'leading': false}
                        );
                    }
                    var changed_features = {}
                    _.each(_.keys(model.changed), function (k) {
                        if (!_.isNil(ROOM_FEATURES_MAP[k])) {
                            changed_features[ROOM_FEATURES_MAP[k]] = !model.changed[k];
                        }
                    });
                    this.chatroomview.model.save(changed_features, {'silent': true});
                    this.debouncedRenderRoomFeatures();
                },


                setOccupantsHeight: function () {
                    var el = this.el.querySelector('.chatroom-features');
                    this.el.querySelector('.occupant-list').style.cssText =
                        'height: calc(100% - '+el.offsetHeight+'px - 5em);';
                },

                onOccupantAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = this.add(item.get('id'), new _converse.ChatRoomOccupantView({model: item}));
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
                    /* Given a presence stanza, update the occupant models
                     * based on its contents.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The presence stanza
                     */
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

                promptForInvite: function (suggestion) {
                    var reason = prompt(
                        __(___('You are about to invite %1$s to the chat room "%2$s". '), suggestion.text.label, this.model.get('id')) +
                        __("You may optionally include a message, explaining the reason for the invitation.")
                    );
                    if (reason !== null) {
                        this.chatroomview.directInvite(suggestion.text.value, reason);
                    }
                    suggestion.target.value = '';
                },

                inviteFormSubmitted: function (evt) {
                    evt.preventDefault();
                    var el = evt.target.querySelector('input.invited-contact');
                    this.promptForInvite({
                        'target': el,
                        'text': {
                            'label': el.value,
                            'value': el.value
                        }});
                },

                shouldInviteWidgetBeShown: function () {
                    return _converse.allow_muc_invitations &&
                        (this.chatroomview.model.get('open') ||
                            this.chatroomview.model.get('affiliation') === "owner"
                        );
                },

                initInviteWidget: function () {
                    var form = this.el.querySelector('form.room-invite');
                    if (_.isNull(form)) {
                        return;
                    }
                    form.addEventListener('submit', this.inviteFormSubmitted.bind(this));
                    var el = this.el.querySelector('input.invited-contact');
                    var list = _converse.roster.map(function (item) {
                            var label = item.get('fullname') || item.get('jid');
                            return {'label': label, 'value':item.get('jid')};
                        });
                    var awesomplete = new Awesomplete(el, {
                        'minChars': 1,
                        'list': list
                    });
                    el.addEventListener('awesomplete-selectcomplete', this.promptForInvite.bind(this));
                }
            });

            _converse.RoomsPanel = Backbone.View.extend({
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
                    'click a.room-info': 'toggleRoomInfo',
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
                            tpl_room_panel({
                                'server_input_type': _converse.hide_muc_server && 'hidden' || 'text',
                                'server_label_global_attr': _converse.hide_muc_server && ' hidden' || '',
                                'label_room_name': __('Room name'),
                                'label_nickname': __('Nickname'),
                                'label_server': __('Server'),
                                'label_join': __('Join Room'),
                                'label_show_rooms': __('Show rooms')
                            })
                        ));
                    this.$tabs = this.$parent.parent().find('#controlbox-tabs');

                    var controlbox = _converse.chatboxes.get('controlbox');
                    this.$tabs.append(tpl_chatrooms_tab({
                        'label_rooms': __('Rooms'),
                        'is_current': controlbox.get('active-panel') === ROOMS_PANEL_ID
                    }));
                    if (controlbox.get('active-panel') !== ROOMS_PANEL_ID) {
                        this.$el.addClass('hidden');
                    }
                    return this;
                },

                onDomainChange: function (model) {
                    var $server = this.$el.find('input.new-chatroom-server');
                    $server.val(model.get('muc_domain'));
                    if (_converse.auto_list_rooms) {
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
                                tpl_room_item({
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
                    _converse.connection.sendIQ(
                        $iq({
                            to: this.model.get('muc_domain'),
                            from: _converse.connection.jid,
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

                insertRoomInfo: function (el, stanza) {
                    /* Insert room info (based on returned #disco IQ stanza)
                     *
                     * Parameters:
                     *  (HTMLElement) el: The HTML DOM element that should
                     *      contain the info.
                     *  (XMLElement) stanza: The IQ stanza containing the room
                     *      info.
                     */
                    var $stanza = $(stanza);
                    // All MUC features found here: http://xmpp.org/registrar/disco-features.html
                    $(el).find('span.spinner').replaceWith(
                        tpl_room_description({
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
                        })
                    );
                },

                toggleRoomInfo: function (ev) {
                    /* Show/hide extra information about a room in the listing.
                     */
                    var target = ev.target,
                        $parent = $(target).parent('dd'),
                        $div = $parent.find('div.room-info');
                    if ($div.length) {
                        $div.remove();
                    } else {
                        $parent.find('span.spinner').remove();
                        $parent.append('<span class="spinner hor_centered"/>');
                        _converse.connection.disco.info(
                            $(target).attr('data-room-jid'), null, _.partial(this.insertRoomInfo, $parent[0])
                        );
                    }
                },

                createChatRoom: function (ev) {
                    ev.preventDefault();
                    var name, $name, server, $server, jid;
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
                    _converse.createChatRoom({
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
            /************************ End of ChatRoomView **********************/


            _converse.onDirectMUCInvitation = function (message) {
                /* A direct MUC invitation to join a room has been received
                 * See XEP-0249: Direct MUC invitations.
                 *
                 * Parameters:
                 *  (XMLElement) message: The message stanza containing the
                 *        invitation.
                 */
                var $message = $(message),
                    $x = $message.children('x[xmlns="jabber:x:conference"]'),
                    from = Strophe.getBareJidFromJid($message.attr('from')),
                    room_jid = $x.attr('jid'),
                    reason = $x.attr('reason'),
                    contact = _converse.roster.get(from),
                    result;

                if (_converse.auto_join_on_invite) {
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
                    var chatroom = _converse.createChatRoom({
                        'id': room_jid,
                        'jid': room_jid,
                        'name': Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)),
                        'nick': Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.connection.jid)),
                        'type': 'chatroom',
                        'box_id': b64_sha1(room_jid),
                        'password': $x.attr('password')
                    });
                    if (chatroom.get('connection_status') === ROOMSTATUS.DISCONNECTED) {
                        _converse.chatboxviews.get(room_jid).join();
                    }
                }
            };

            if (_converse.allow_muc_invitations) {
                var registerDirectInvitationHandler = function () {
                    _converse.connection.addHandler(
                        function (message) {
                            _converse.onDirectMUCInvitation(message);
                            return true;
                        }, 'jabber:x:conference', 'message');
                };
                _converse.on('connected', registerDirectInvitationHandler);
                _converse.on('reconnected', registerDirectInvitationHandler);
            }

            var autoJoinRooms = function () {
                /* Automatically join chat rooms, based on the
                 * "auto_join_rooms" configuration setting, which is an array
                 * of strings (room JIDs) or objects (with room JID and other
                 * settings).
                 */
                _.each(_converse.auto_join_rooms, function (room) {
                    if (_.isString(room)) {
                        _converse.api.rooms.open(room);
                    } else if (_.isObject(room)) {
                        _converse.api.rooms.open(room.jid, room.nick);
                    } else {
                        _converse.log('Invalid room criteria specified for "auto_join_rooms"', 'error');
                    }
                });
            };
            _converse.on('chatBoxesFetched', autoJoinRooms);

            _converse.getChatRoom = function (jid, attrs, fetcher) {
                jid = jid.toLowerCase();
                return _converse.getViewForChatBox(fetcher(_.extend({
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
            _.extend(_converse.api, {
                'rooms': {
                    'close': function (jids) {
                        if (_.isUndefined(jids)) {
                            _converse.chatboxviews.each(function (view) {
                                if (view.is_chatroom && view.model) {
                                    view.close();
                                }
                            });
                        } else if (_.isString(jids)) {
                            var view = _converse.chatboxviews.get(jids);
                            if (view) { view.close(); }
                        } else {
                            _.each(jids, function (jid) {
                                var view = _converse.chatboxviews.get(jid);
                                if (view) { view.close(); }
                            });
                        }
                    },
                    'open': function (jids, attrs) {
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
                            return _converse.getChatRoom(jids, attrs, _converse.createChatRoom);
                        }
                        return _.map(jids, _.partial(_converse.getChatRoom, _, attrs, _converse.createChatRoom));
                    },
                    'get': function (jids, attrs, create) {
                        if (_.isString(attrs)) {
                            attrs = {'nick': attrs};
                        } else if (_.isUndefined(attrs)) {
                            attrs = {};
                        }
                        if (_.isUndefined(jids)) {
                            var result = [];
                            _converse.chatboxes.each(function (chatbox) {
                                if (chatbox.get('type') === 'chatroom') {
                                    result.push(_converse.getViewForChatBox(chatbox));
                                }
                            });
                            return result;
                        }
                        var fetcher = _.partial(_converse.chatboxviews.getChatBox.bind(_converse.chatboxviews), _, create);
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

            var reconnectToChatRooms = function () {
                /* Upon a reconnection event from converse, join again
                 * all the open chat rooms.
                 */
                _converse.chatboxviews.each(function (view) {
                    if (view.model.get('type') === 'chatroom') {
                        view.model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                        view.join();
                    }
                });
            };
            _converse.on('reconnected', reconnectToChatRooms);

            var disconnectChatRooms = function () {
                /* When disconnecting, or reconnecting, mark all chat rooms as
                 * disconnected, so that they will be properly entered again
                 * when fetched from session storage.
                 */
                _converse.chatboxes.each(function (model) {
                    if (model.get('type') === 'chatroom') {
                        model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                    }
                });
            };
            _converse.on('reconnecting', disconnectChatRooms);
            _converse.on('disconnecting', disconnectChatRooms);
        }
    });
}));
