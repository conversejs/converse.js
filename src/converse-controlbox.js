// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, Backbone */

(function (root, factory) {
    define("converse-controlbox", [
            "converse-core",
            "converse-api",
            // TODO: remove this dependency
            "converse-chatview"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        b64_sha1 = converse_api.env.b64_sha1,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        __ = utils.__.bind(converse),
        moment = converse_api.env.moment;


    converse_api.plugins.add('controlbox', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            initSession: function () {
                this.controlboxtoggle = new this.ControlBoxToggle();
                this._super.initSession.apply(this, arguments);
            },

            initConnection: function () {
                this._super.initConnection.apply(this, arguments);
                if (this.connection) {
                    this.addControlBox();
                }
            },

            _tearDown: function () {
                this._super._tearDown.apply(this, arguments);
                if (this.rosterview) {
                    this.rosterview.unregisterHandlers();
                    // Removes roster groups
                    this.rosterview.model.off().reset();
                    this.rosterview.undelegateEvents().remove();
                }
            },

            clearSession: function () {
                this._super.clearSession.apply(this, arguments);
                if (this.connection.connected) {
                    this.chatboxes.get('controlbox').save({'connected': false});
                }
            },

            ChatBoxes: {
                onChatBoxesFetched: function (collection, resp) {
                    collection.each(function (chatbox) {
                        if (chatbox.get('id') !== 'controlbox' && !chatbox.get('minimized')) {
                            chatbox.trigger('show');
                        }
                    });
                    if (!_.include(_.pluck(resp, 'id'), 'controlbox')) {
                        this.add({
                            id: 'controlbox',
                            box_id: 'controlbox'
                        });
                    }
                    this.get('controlbox').save({connected:true});
                },

            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view && item.get('box_id') === 'controlbox') {
                        view = new converse.ControlBoxView({model: item});
                        this.add(item.get('id'), view);
                    } else {
                        this._super.onChatBoxAdded.apply(this, arguments);
                    }
                },

                closeAllChatBoxes: function () {
                    this.each(function (view) {
                        if (view.model.get('id') !== 'controlbox') {
                            view.close();
                        }
                    });
                    return this;
                },

                getOldestMaximizedChat: function (exclude_ids) {
                    exclude_ids.push('controlbox');
                    return this._super.getOldestMaximizedChat.apply(this, arguments);
                },

                getChatBoxWidth: function (view) {
                    var controlbox = this.get('controlbox');
                    if (view.model.get('id') === 'controlbox') {
                        /* We return the width of the controlbox or its toggle,
                         * depending on which is visible.
                         */
                        if (!controlbox || !controlbox.$el.is(':visible')) {
                            return converse.controlboxtoggle.$el.outerWidth(true);
                        } else {
                            return controlbox.$el.outerWidth(true);
                        }
                    } else {
                        return this._super.getChatBoxWidth.apply(this, arguments);
                    }
                }
            },


            MinimizedChats: {
                onChanged: function (item) {
                    if (item.get('id') === 'controlbox')  {
                        return;
                    } else {
                        this._super.onChanged.apply(this, arguments);
                    }
                }
            },


            ChatBox: {
                initialize: function () {
                    if (this.get('id') === 'controlbox') {
                        this.set(
                            _.extend(
                                this.getDefaultSettings(),
                                { 'time_opened': moment(0).valueOf() }
                            ));
                    } else {
                        this._super.initialize.apply(this, arguments);
                    }
                },
            },


            ChatBoxView: {
                insertIntoPage: function () {
                    this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
                    return this;
                },

                maximize: function () {
                    var chatboxviews = converse.chatboxviews;
                    // Restores a minimized chat box
                    this.$el.insertAfter(chatboxviews.get("controlbox").$el).show('fast', this.onMaximized.bind(this));
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            var settings = {
                show_controlbox_by_default: false,
            };
            _.extend(converse.default_settings, settings);
            _.extend(converse, settings);
            _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));

            var STATUSES = {
                'dnd': __('This contact is busy'),
                'online': __('This contact is online'),
                'offline': __('This contact is offline'),
                'unavailable': __('This contact is unavailable'),
                'xa': __('This contact is away for an extended period'),
                'away': __('This contact is away')
            };
            var DESC_GROUP_TOGGLE = __('Click to hide these contacts');
            var LABEL_CONTACTS = __('Contacts');
            var LABEL_GROUPS = __('Groups');
            var HEADER_CURRENT_CONTACTS =  __('My contacts');
            var HEADER_PENDING_CONTACTS = __('Pending contacts');
            var HEADER_REQUESTING_CONTACTS = __('Contact requests');
            var HEADER_UNGROUPED = __('Ungrouped');
            var HEADER_WEIGHTS = {};
            HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS]    = 0;
            HEADER_WEIGHTS[HEADER_UNGROUPED]           = 1;
            HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 2;
            HEADER_WEIGHTS[HEADER_PENDING_CONTACTS]    = 3;

            converse.addControlBox = function () {
                return converse.chatboxes.add({
                    id: 'controlbox',
                    box_id: 'controlbox',
                    closed: !converse.show_controlbox_by_default
                });
            };

            converse.renderLoginPanel = function () {
                converse._tearDown();
                var view = converse.chatboxviews.get('controlbox');
                view.model.set({connected:false});
                view.renderLoginPanel();
            };


            converse.ControlBoxView = converse.ChatBoxView.extend({
                tagName: 'div',
                className: 'chatbox',
                id: 'controlbox',
                events: {
                    'click a.close-chatbox-button': 'close',
                    'click ul#controlbox-tabs li a': 'switchTab',
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    this.$el.insertAfter(converse.controlboxtoggle.$el);
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.model.on('change:connected', this.onConnected, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('hide', this.hide, this);
                    this.model.on('show', this.show, this);
                    this.model.on('change:closed', this.ensureClosedState, this);
                    this.render();
                    if (this.model.get('connected')) {
                        this.initRoster();
                    }
                    if (typeof this.model.get('closed')==='undefined') {
                        this.model.set('closed', !converse.show_controlbox_by_default);
                    }
                    if (!this.model.get('closed')) {
                        this.show();
                    } else {
                        this.hide();
                    }
                },

                render: function () {
                    if (!converse.connection.connected || !converse.connection.authenticated || converse.connection.disconnecting) {
                        // TODO: we might need to take prebinding into consideration here.
                        this.renderLoginPanel();
                    } else if (!this.contactspanel || !this.contactspanel.$el.is(':visible')) {
                        this.renderContactsPanel();
                    }
                    return this;
                },

                giveFeedback: function (message, klass) {
                    var $el = this.$('.conn-feedback');
                    $el.addClass('conn-feedback').text(message);
                    if (klass) {
                        $el.addClass(klass);
                    }
                },

                onConnected: function () {
                    if (this.model.get('connected')) {
                        this.render().initRoster();
                    }
                },

                initRoster: function () {
                    /* We initialize the roster, which will appear inside the
                    * Contacts Panel.
                    */
                    var rostergroups = new converse.RosterGroups();
                    rostergroups.browserStorage = new Backbone.BrowserStorage[converse.storage](
                        b64_sha1('converse.roster.groups'+converse.bare_jid));
                    converse.rosterview = new converse.RosterView({model: rostergroups});
                    this.contactspanel.$el.append(converse.rosterview.$el);
                    converse.rosterview.render().fetch().update();
                    return this;
                },

                renderLoginPanel: function () {
                    var $feedback = this.$('.conn-feedback'); // we want to still show any existing feedback.
                    this.$el.html(converse.templates.controlbox(this.model.toJSON()));
                    var cfg = {
                        '$parent': this.$el.find('.controlbox-panes'),
                        'model': this
                    };
                    if (!this.loginpanel) {
                        this.loginpanel = new converse.LoginPanel(cfg);
                    } else {
                        this.loginpanel.delegateEvents().initialize(cfg);
                    }
                    this.loginpanel.render();
                    this.initDragResize().setDimensions();
                    if ($feedback.length && $feedback.text() !== __('Connecting')) {
                        this.$('.conn-feedback').replaceWith($feedback);
                    }
                    return this;
                },

                renderContactsPanel: function () {
                    this.$el.html(converse.templates.controlbox(this.model.toJSON()));
                    this.contactspanel = new converse.ContactsPanel({
                        '$parent': this.$el.find('.controlbox-panes')
                    });
                    this.contactspanel.render();
                    converse.xmppstatusview = new converse.XMPPStatusView({
                        'model': converse.xmppstatus
                    });
                    converse.xmppstatusview.render();
                    this.initDragResize().setDimensions();
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (converse.connection.connected) {
                        this.model.save({'closed': true});
                    } else {
                        this.model.trigger('hide');
                    }
                    converse.emit('controlBoxClosed', this);
                    return this;
                },

                ensureClosedState: function () {
                    if (this.model.get('closed')) {
                        this.hide();
                    } else {
                        this.show();
                    }
                },

                hide: function (callback) {
                    this.$el.hide('fast', function () {
                        utils.refreshWebkit();
                        converse.emit('chatBoxClosed', this);
                        converse.controlboxtoggle.show(function () {
                            if (typeof callback === "function") {
                                callback();
                            }
                        });
                    });
                    return this;
                },

                show: function () {
                    converse.controlboxtoggle.hide(function () {
                        converse.chatboxviews.trimChats(this);
                        this.$el.show('fast', function () {
                            if (converse.rosterview) {
                                converse.rosterview.update();
                            }
                            utils.refreshWebkit();
                        }.bind(this));
                        converse.emit('controlBoxOpened', this);
                    }.bind(this));
                    return this;
                },

                switchTab: function (ev) {
                    // TODO: automatically focus the relevant input
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $tab = $(ev.target),
                        $sibling = $tab.parent().siblings('li').children('a'),
                        $tab_panel = $($tab.attr('href'));
                    $($sibling.attr('href')).hide();
                    $sibling.removeClass('current');
                    $tab.addClass('current');
                    $tab_panel.show();
                    return this;
                },

                showHelpMessages: function (msgs) {
                    // Override showHelpMessages in ChatBoxView, for now do nothing.
                    return;
                }
            });


            converse.LoginPanel = Backbone.View.extend({
                tagName: 'div',
                id: "login-dialog",
                className: 'controlbox-pane',
                events: {
                    'submit form#converse-login': 'authenticate'
                },

                initialize: function (cfg) {
                    cfg.$parent.html(this.$el.html(
                        converse.templates.login_panel({
                            'LOGIN': converse.LOGIN,
                            'ANONYMOUS': converse.ANONYMOUS,
                            'PREBIND': converse.PREBIND,
                            'auto_login': converse.auto_login,
                            'authentication': converse.authentication,
                            'label_username': __('XMPP Username:'),
                            'label_password': __('Password:'),
                            'label_anon_login': __('Click here to log in anonymously'),
                            'label_login': __('Log In'),
                            'placeholder_username': (converse.locked_domain || converse.default_domain) && __('Username') || __('user@server'),
                            'placeholder_password': __('password')
                        })
                    ));
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                },

                render: function () {
                    this.$tabs.append(converse.templates.login_tab({label_sign_in: __('Sign in')}));
                    this.$el.find('input#jid').focus();
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                    return this;
                },

                authenticate: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $form = $(ev.target);
                    if (converse.authentication === converse.ANONYMOUS) {
                        this.connect($form, converse.jid, null);
                        return;
                    }
                    var $jid_input = $form.find('input[name=jid]'),
                        jid = $jid_input.val(),
                        $pw_input = $form.find('input[name=password]'),
                        password = $pw_input.val(),
                        errors = false;

                    if (! jid) {
                        errors = true;
                        $jid_input.addClass('error');
                    }
                    if (! password)  {
                        errors = true;
                        $pw_input.addClass('error');
                    }
                    if (errors) { return; }
                    if (converse.locked_domain) {
                        jid = Strophe.escapeNode(jid) + '@' + converse.locked_domain;
                    } else if (converse.default_domain && jid.indexOf('@') === -1) {
                        jid = jid + '@' + converse.default_domain;
                    }
                    this.connect($form, jid, password);
                    return false;
                },

                connect: function ($form, jid, password) {
                    var resource;
                    if ($form) {
                        $form.find('input[type=submit]').hide().after('<span class="spinner login-submit"/>');
                    }
                    if (jid) {
                        resource = Strophe.getResourceFromJid(jid);
                        if (!resource) {
                            jid = jid.toLowerCase() + converse.generateResource();
                        } else {
                            jid = Strophe.getBareJidFromJid(jid).toLowerCase()+'/'+resource;
                        }
                    }
                    converse.connection.connect(jid, password, converse.onConnectStatusChanged);
                },

                remove: function () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });


            converse.XMPPStatusView = Backbone.View.extend({
                el: "span#xmpp-status-holder",

                events: {
                    "click a.choose-xmpp-status": "toggleOptions",
                    "click #fancy-xmpp-status-select a.change-xmpp-status-message": "renderStatusChangeForm",
                    "submit #set-custom-xmpp-status": "setStatusMessage",
                    "click .dropdown dd ul li a": "setStatus"
                },

                initialize: function () {
                    this.model.on("change:status", this.updateStatusUI, this);
                    this.model.on("change:status_message", this.updateStatusUI, this);
                    this.model.on("update-status-ui", this.updateStatusUI, this);
                },

                render: function () {
                    // Replace the default dropdown with something nicer
                    var $select = this.$el.find('select#select-xmpp-status'),
                        chat_status = this.model.get('status') || 'offline',
                        options = $('option', $select),
                        $options_target,
                        options_list = [];
                    this.$el.html(converse.templates.choose_status());
                    this.$el.find('#fancy-xmpp-status-select')
                            .html(converse.templates.chat_status({
                                'status_message': this.model.get('status_message') || __("I am %1$s", this.getPrettyStatus(chat_status)),
                                'chat_status': chat_status,
                                'desc_custom_status': __('Click here to write a custom status message'),
                                'desc_change_status': __('Click to change your chat status')
                                }));
                    // iterate through all the <option> elements and add option values
                    options.each(function () {
                        options_list.push(converse.templates.status_option({
                            'value': $(this).val(),
                            'text': this.text
                        }));
                    });
                    $options_target = this.$el.find("#target dd ul").hide();
                    $options_target.append(options_list.join(''));
                    $select.remove();
                    return this;
                },

                toggleOptions: function (ev) {
                    ev.preventDefault();
                    $(ev.target).parent().parent().siblings('dd').find('ul').toggle('fast');
                },

                renderStatusChangeForm: function (ev) {
                    ev.preventDefault();
                    var status_message = this.model.get('status') || 'offline';
                    var input = converse.templates.change_status_message({
                        'status_message': status_message,
                        'label_custom_status': __('Custom status'),
                        'label_save': __('Save')
                    });
                    var $xmppstatus = this.$el.find('.xmpp-status');
                    $xmppstatus.parent().addClass('no-border');
                    $xmppstatus.replaceWith(input);
                    this.$el.find('.custom-xmpp-status').focus().focus();
                },

                setStatusMessage: function (ev) {
                    ev.preventDefault();
                    this.model.setStatusMessage($(ev.target).find('input').val());
                },

                setStatus: function (ev) {
                    ev.preventDefault();
                    var $el = $(ev.currentTarget),
                        value = $el.attr('data-value');
                    if (value === 'logout') {
                        this.$el.find(".dropdown dd ul").hide();
                        converse.logOut();
                    } else {
                        this.model.setStatus(value);
                        this.$el.find(".dropdown dd ul").hide();
                    }
                },

                getPrettyStatus: function (stat) {
                    if (stat === 'chat') {
                        return __('online');
                    } else if (stat === 'dnd') {
                        return __('busy');
                    } else if (stat === 'xa') {
                        return __('away for long');
                    } else if (stat === 'away') {
                        return __('away');
                    } else if (stat === 'offline') {
                        return __('offline');
                    } else {
                        return __(stat) || __('online');
                    }
                },

                updateStatusUI: function (model) {
                    var stat = model.get('status');
                    // For translators: the %1$s part gets replaced with the status
                    // Example, I am online
                    var status_message = model.get('status_message') || __("I am %1$s", this.getPrettyStatus(stat));
                    this.$el.find('#fancy-xmpp-status-select').removeClass('no-border').html(
                        converse.templates.chat_status({
                            'chat_status': stat,
                            'status_message': status_message,
                            'desc_custom_status': __('Click here to write a custom status message'),
                            'desc_change_status': __('Click to change your chat status')
                        }));
                }
            });


            converse.ContactsPanel = Backbone.View.extend({
                tagName: 'div',
                className: 'controlbox-pane',
                id: 'users',
                events: {
                    'click a.toggle-xmpp-contact-form': 'toggleContactForm',
                    'submit form.add-xmpp-contact': 'addContactFromForm',
                    'submit form.search-xmpp-contact': 'searchContacts',
                    'click a.subscribe-to-user': 'addContactFromList'
                },

                initialize: function (cfg) {
                    cfg.$parent.append(this.$el);
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                },

                render: function () {
                    var markup;
                    var widgets = converse.templates.contacts_panel({
                        label_online: __('Online'),
                        label_busy: __('Busy'),
                        label_away: __('Away'),
                        label_offline: __('Offline'),
                        label_logout: __('Log out'),
                        include_offline_state: converse.include_offline_state,
                        allow_logout: converse.allow_logout
                    });
                    this.$tabs.append(converse.templates.contacts_tab({label_contacts: LABEL_CONTACTS}));
                    if (converse.xhr_user_search) {
                        markup = converse.templates.search_contact({
                            label_contact_name: __('Contact name'),
                            label_search: __('Search')
                        });
                    } else {
                        markup = converse.templates.add_contact_form({
                            label_contact_username: __('e.g. user@example.com'),
                            label_add: __('Add')
                        });
                    }
                    if (converse.allow_contact_requests) {
                        widgets += converse.templates.add_contact_dropdown({
                            label_click_to_chat: __('Click to add new chat contacts'),
                            label_add_contact: __('Add a contact')
                        });
                    }
                    this.$el.html(widgets);
                    this.$el.find('.search-xmpp ul').append(markup);
                    return this;
                },

                toggleContactForm: function (ev) {
                    ev.preventDefault();
                    this.$el.find('.search-xmpp').toggle('fast', function () {
                        if ($(this).is(':visible')) {
                            $(this).find('input.username').focus();
                        }
                    });
                },

                searchContacts: function (ev) {
                    ev.preventDefault();
                    $.getJSON(converse.xhr_user_search_url+ "?q=" + $(ev.target).find('input.username').val(), function (data) {
                        var $ul= $('.search-xmpp ul');
                        $ul.find('li.found-user').remove();
                        $ul.find('li.chat-info').remove();
                        if (!data.length) {
                            $ul.append('<li class="chat-info">'+__('No users found')+'</li>');
                        }
                        $(data).each(function (idx, obj) {
                            $ul.append(
                                $('<li class="found-user"></li>')
                                .append(
                                    $('<a class="subscribe-to-user" href="#" title="'+__('Click to add as a chat contact')+'"></a>')
                                    .attr('data-recipient', Strophe.getNodeFromJid(obj.id)+"@"+Strophe.getDomainFromJid(obj.id))
                                    .text(obj.fullname)
                                )
                            );
                        });
                    });
                },

                addContactFromForm: function (ev) {
                    ev.preventDefault();
                    var $input = $(ev.target).find('input');
                    var jid = $input.val();
                    if (! jid) {
                        // this is not a valid JID
                        $input.addClass('error');
                        return;
                    }
                    converse.roster.addAndSubscribe(jid);
                    $('.search-xmpp').hide();
                },

                addContactFromList: function (ev) {
                    ev.preventDefault();
                    var $target = $(ev.target),
                        jid = $target.attr('data-recipient'),
                        name = $target.text();
                    converse.roster.addAndSubscribe(jid, name);
                    $target.parent().remove();
                    $('.search-xmpp').hide();
                }
            });


            converse.RosterContactView = Backbone.View.extend({
                tagName: 'dd',

                events: {
                    "click .accept-xmpp-request": "acceptRequest",
                    "click .decline-xmpp-request": "declineRequest",
                    "click .open-chat": "openChat",
                    "click .remove-xmpp-contact": "removeContact"
                },

                initialize: function () {
                    this.model.on("change", this.render, this);
                    this.model.on("remove", this.remove, this);
                    this.model.on("destroy", this.remove, this);
                    this.model.on("open", this.openChat, this);
                },

                render: function () {
                    if (!this.model.showInRoster()) {
                        this.$el.hide();
                        return this;
                    } else if (this.$el[0].style.display === "none") {
                        this.$el.show();
                    }
                    var item = this.model,
                        ask = item.get('ask'),
                        chat_status = item.get('chat_status'),
                        requesting  = item.get('requesting'),
                        subscription = item.get('subscription');

                    var classes_to_remove = [
                        'current-xmpp-contact',
                        'pending-xmpp-contact',
                        'requesting-xmpp-contact'
                        ].concat(_.keys(STATUSES));

                    _.each(classes_to_remove,
                        function (cls) {
                            if (this.el.className.indexOf(cls) !== -1) {
                                this.$el.removeClass(cls);
                            }
                        }, this);
                    this.$el.addClass(chat_status).data('status', chat_status);

                    if ((ask === 'subscribe') || (subscription === 'from')) {
                        /* ask === 'subscribe'
                        *      Means we have asked to subscribe to them.
                        *
                        * subscription === 'from'
                        *      They are subscribed to use, but not vice versa.
                        *      We assume that there is a pending subscription
                        *      from us to them (otherwise we're in a state not
                        *      supported by converse.js).
                        *
                        *  So in both cases the user is a "pending" contact.
                        */
                        this.$el.addClass('pending-xmpp-contact');
                        this.$el.html(converse.templates.pending_contact(
                            _.extend(item.toJSON(), {
                                'desc_remove': __('Click to remove this contact'),
                                'allow_chat_pending_contacts': converse.allow_chat_pending_contacts
                            })
                        ));
                    } else if (requesting === true) {
                        this.$el.addClass('requesting-xmpp-contact');
                        this.$el.html(converse.templates.requesting_contact(
                            _.extend(item.toJSON(), {
                                'desc_accept': __("Click to accept this contact request"),
                                'desc_decline': __("Click to decline this contact request"),
                                'allow_chat_pending_contacts': converse.allow_chat_pending_contacts
                            })
                        ));
                        converse.controlboxtoggle.showControlBox();
                    } else if (subscription === 'both' || subscription === 'to') {
                        this.$el.addClass('current-xmpp-contact');
                        this.$el.removeClass(_.without(['both', 'to'], subscription)[0]).addClass(subscription);
                        this.$el.html(converse.templates.roster_item(
                            _.extend(item.toJSON(), {
                                'desc_status': STATUSES[chat_status||'offline'],
                                'desc_chat': __('Click to chat with this contact'),
                                'desc_remove': __('Click to remove this contact'),
                                'title_fullname': __('Name'),
                                'allow_contact_removal': converse.allow_contact_removal
                            })
                        ));
                    }
                    return this;
                },

                openChat: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    return converse.chatboxviews.showChat(this.model.attributes);
                },

                removeContact: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (!converse.allow_contact_removal) { return; }
                    var result = confirm(__("Are you sure you want to remove this contact?"));
                    if (result === true) {
                        var iq = $iq({type: 'set'})
                            .c('query', {xmlns: Strophe.NS.ROSTER})
                            .c('item', {jid: this.model.get('jid'), subscription: "remove"});
                        converse.connection.sendIQ(iq,
                            function (iq) {
                                this.model.destroy();
                                this.remove();
                            }.bind(this),
                            function (err) {
                                alert(__("Sorry, there was an error while trying to remove "+name+" as a contact."));
                                converse.log(err);
                            }
                        );
                    }
                },

                acceptRequest: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    converse.roster.sendContactAddIQ(
                        this.model.get('jid'),
                        this.model.get('fullname'),
                        [],
                        function () { this.model.authorize().subscribe(); }.bind(this)
                    );
                },

                declineRequest: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var result = confirm(__("Are you sure you want to decline this contact request?"));
                    if (result === true) {
                        this.model.unauthorize().destroy();
                    }
                    return this;
                }
            });


            converse.RosterGroup = Backbone.Model.extend({
                initialize: function (attributes, options) {
                    this.set(_.extend({
                        description: DESC_GROUP_TOGGLE,
                        state: converse.OPENED
                    }, attributes));
                    // Collection of contacts belonging to this group.
                    this.contacts = new converse.RosterContacts();
                }
            });


            converse.RosterGroupView = Backbone.Overview.extend({
                tagName: 'dt',
                className: 'roster-group',
                events: {
                    "click a.group-toggle": "toggle"
                },

                initialize: function () {
                    this.model.contacts.on("add", this.addContact, this);
                    this.model.contacts.on("change:subscription", this.onContactSubscriptionChange, this);
                    this.model.contacts.on("change:requesting", this.onContactRequestChange, this);
                    this.model.contacts.on("change:chat_status", function (contact) {
                        // This might be optimized by instead of first sorting,
                        // finding the correct position in positionContact
                        this.model.contacts.sort();
                        this.positionContact(contact).render();
                    }, this);
                    this.model.contacts.on("destroy", this.onRemove, this);
                    this.model.contacts.on("remove", this.onRemove, this);
                    converse.roster.on('change:groups', this.onContactGroupChange, this);
                },

                render: function () {
                    this.$el.attr('data-group', this.model.get('name'));
                    this.$el.html(
                        $(converse.templates.group_header({
                            label_group: this.model.get('name'),
                            desc_group_toggle: this.model.get('description'),
                            toggle_state: this.model.get('state')
                        }))
                    );
                    return this;
                },

                addContact: function (contact) {
                    var view = new converse.RosterContactView({model: contact});
                    this.add(contact.get('id'), view);
                    view = this.positionContact(contact).render();
                    if (contact.showInRoster()) {
                        if (this.model.get('state') === converse.CLOSED) {
                            if (view.$el[0].style.display !== "none") { view.$el.hide(); }
                            if (!this.$el.is(':visible')) { this.$el.show(); }
                        } else {
                            if (this.$el[0].style.display !== "block") { this.show(); }
                        }
                    }
                },

                positionContact: function (contact) {
                    /* Place the contact's DOM element in the correct alphabetical
                    * position amongst the other contacts in this group.
                    */
                    var view = this.get(contact.get('id'));
                    var index = this.model.contacts.indexOf(contact);
                    view.$el.detach();
                    if (index === 0) {
                        this.$el.after(view.$el);
                    } else if (index === (this.model.contacts.length-1)) {
                        this.$el.nextUntil('dt').last().after(view.$el);
                    } else {
                        this.$el.nextUntil('dt').eq(index).before(view.$el);
                    }
                    return view;
                },

                show: function () {
                    this.$el.show();
                    _.each(this.getAll(), function (contactView) {
                        if (contactView.model.showInRoster()) {
                            contactView.$el.show();
                        }
                    });
                },

                hide: function () {
                    this.$el.nextUntil('dt').addBack().hide();
                },

                filter: function (q) {
                    /* Filter the group's contacts based on the query "q".
                    * The query is matched against the contact's full name.
                    * If all contacts are filtered out (i.e. hidden), then the
                    * group must be filtered out as well.
                    */
                    var matches;
                    if (q.length === 0) {
                        if (this.model.get('state') === converse.OPENED) {
                            this.model.contacts.each(function (item) {
                                if (item.showInRoster()) {
                                    this.get(item.get('id')).$el.show();
                                }
                            }.bind(this));
                        }
                        this.showIfNecessary();
                    } else {
                        q = q.toLowerCase();
                        matches = this.model.contacts.filter(utils.contains.not('fullname', q));
                        if (matches.length === this.model.contacts.length) { // hide the whole group
                            this.hide();
                        } else {
                            _.each(matches, function (item) {
                                this.get(item.get('id')).$el.hide();
                            }.bind(this));
                            _.each(this.model.contacts.reject(utils.contains.not('fullname', q)), function (item) {
                                this.get(item.get('id')).$el.show();
                            }.bind(this));
                            this.showIfNecessary();
                        }
                    }
                },

                showIfNecessary: function () {
                    if (!this.$el.is(':visible') && this.model.contacts.length > 0) {
                        this.$el.show();
                    }
                },

                toggle: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$el.nextUntil('dt').slideUp();
                        this.model.save({state: converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.model.save({state: converse.OPENED});
                        this.filter(
                            converse.rosterview.$('.roster-filter').val(),
                            converse.rosterview.$('.filter-type').val()
                        );
                    }
                },

                onContactGroupChange: function (contact) {
                    var in_this_group = _.contains(contact.get('groups'), this.model.get('name'));
                    var cid = contact.get('id');
                    var in_this_overview = !this.get(cid);
                    if (in_this_group && !in_this_overview) {
                        this.model.contacts.remove(cid);
                    } else if (!in_this_group && in_this_overview) {
                        this.addContact(contact);
                    }
                },

                onContactSubscriptionChange: function (contact) {
                    if ((this.model.get('name') === HEADER_PENDING_CONTACTS) && contact.get('subscription') !== 'from') {
                        this.model.contacts.remove(contact.get('id'));
                    }
                },

                onContactRequestChange: function (contact) {
                    if ((this.model.get('name') === HEADER_REQUESTING_CONTACTS) && !contact.get('requesting')) {
                        this.model.contacts.remove(contact.get('id'));
                    }
                },

                onRemove: function (contact) {
                    this.remove(contact.get('id'));
                    if (this.model.contacts.length === 0) {
                        this.$el.hide();
                    }
                }
            });


            converse.RosterGroups = Backbone.Collection.extend({
                model: converse.RosterGroup,
                comparator: function (a, b) {
                    /* Groups are sorted alphabetically, ignoring case.
                    * However, Ungrouped, Requesting Contacts and Pending Contacts
                    * appear last and in that order. */
                    a = a.get('name');
                    b = b.get('name');
                    var special_groups = _.keys(HEADER_WEIGHTS);
                    var a_is_special = _.contains(special_groups, a);
                    var b_is_special = _.contains(special_groups, b);
                    if (!a_is_special && !b_is_special ) {
                        return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                    } else if (a_is_special && b_is_special) {
                        return HEADER_WEIGHTS[a] < HEADER_WEIGHTS[b] ? -1 : (HEADER_WEIGHTS[a] > HEADER_WEIGHTS[b] ? 1 : 0);
                    } else if (!a_is_special && b_is_special) {
                        return (b === HEADER_CURRENT_CONTACTS) ? 1 : -1;
                    } else if (a_is_special && !b_is_special) {
                        return (a === HEADER_CURRENT_CONTACTS) ? -1 : 1;
                    }
                }
            });

            converse.RosterView = Backbone.Overview.extend({
                tagName: 'div',
                id: 'converse-roster',
                events: {
                    "keydown .roster-filter": "liveFilter",
                    "click .onX": "clearFilter",
                    "mousemove .x": "togglePointer",
                    "change .filter-type": "changeFilterType"
                },

                initialize: function () {
                    this.roster_handler_ref = this.registerRosterHandler();
                    this.rosterx_handler_ref = this.registerRosterXHandler();
                    this.presence_ref = this.registerPresenceHandler();
                    converse.roster.on("add", this.onContactAdd, this);
                    converse.roster.on('change', this.onContactChange, this);
                    converse.roster.on("destroy", this.update, this);
                    converse.roster.on("remove", this.update, this);
                    this.model.on("add", this.onGroupAdd, this);
                    this.model.on("reset", this.reset, this);
                    this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                },

                unregisterHandlers: function () {
                    converse.connection.deleteHandler(this.roster_handler_ref);
                    delete this.roster_handler_ref;
                    converse.connection.deleteHandler(this.rosterx_handler_ref);
                    delete this.rosterx_handler_ref;
                    converse.connection.deleteHandler(this.presence_ref);
                    delete this.presence_ref;
                },

                update: _.debounce(function () {
                    var $count = $('#online-count');
                    $count.text('('+converse.roster.getNumOnlineContacts()+')');
                    if (!$count.is(':visible')) {
                        $count.show();
                    }
                    if (this.$roster.parent().length === 0) {
                        this.$el.append(this.$roster.show());
                    }
                    return this.showHideFilter();
                }, converse.animate ? 100 : 0),

                render: function () {
                    this.$el.html(converse.templates.roster({
                        placeholder: __('Type to filter'),
                        label_contacts: LABEL_CONTACTS,
                        label_groups: LABEL_GROUPS
                    }));
                    if (!converse.allow_contact_requests) {
                        // XXX: if we ever support live editing of config then
                        // we'll need to be able to remove this class on the fly.
                        this.$el.addClass('no-contact-requests');
                    }
                    return this;
                },

                fetch: function () {
                    this.model.fetch({
                        silent: true, // We use the success handler to handle groups that were added,
                                    // we need to first have all groups before positionFetchedGroups
                                    // will work properly.
                        success: function (collection, resp, options) {
                            if (collection.length !== 0) {
                                this.positionFetchedGroups(collection, resp, options);
                            }
                            converse.roster.fetch({
                                add: true,
                                success: function (collection) {
                                    if (collection.length === 0) {
                                        /* We don't have any roster contacts stored in sessionStorage,
                                        * so lets fetch the roster from the XMPP server. We pass in
                                        * 'sendPresence' as callback method, because after initially
                                        * fetching the roster we are ready to receive presence
                                        * updates from our contacts.
                                        */
                                        converse.roster.fetchFromServer(function () {
                                            converse.xmppstatus.sendPresence();
                                        });
                                    } else if (converse.send_initial_presence) {
                                        /* We're not going to fetch the roster again because we have
                                        * it already cached in sessionStorage, but we still need to
                                        * send out a presence stanza because this is a new session.
                                        * See: https://github.com/jcbrand/converse.js/issues/536
                                        */
                                        converse.xmppstatus.sendPresence();
                                    }
                                }
                            });
                        }.bind(this)
                    });
                    return this;
                },

                changeFilterType: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.clearFilter();
                    this.filter(
                        this.$('.roster-filter').val(),
                        ev.target.value
                    );
                },

                tog: function (v) {
                    return v?'addClass':'removeClass';
                },

                togglePointer: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var el = ev.target;
                    $(el)[this.tog(el.offsetWidth-18 < ev.clientX-el.getBoundingClientRect().left)]('onX');
                },

                filter: function (query, type) {
                    query = query.toLowerCase();
                    if (type === 'groups') {
                        _.each(this.getAll(), function (view, idx) {
                            if (view.model.get('name').toLowerCase().indexOf(query.toLowerCase()) === -1) {
                                view.hide();
                            } else if (view.model.contacts.length > 0) {
                                view.show();
                            }
                        });
                    } else {
                        _.each(this.getAll(), function (view) {
                            view.filter(query, type);
                        });
                    }
                },

                liveFilter: _.debounce(function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $filter = this.$('.roster-filter');
                    var q = $filter.val();
                    var t = this.$('.filter-type').val();
                    $filter[this.tog(q)]('x');
                    this.filter(q, t);
                }, 300),

                clearFilter: function (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                        $(ev.target).removeClass('x onX').val('');
                    }
                    this.filter('');
                },

                showHideFilter: function () {
                    if (!this.$el.is(':visible')) {
                        return;
                    }
                    var $filter = this.$('.roster-filter');
                    var $type  = this.$('.filter-type');
                    var visible = $filter.is(':visible');
                    if (visible && $filter.val().length > 0) {
                        // Don't hide if user is currently filtering.
                        return;
                    }
                    if (this.$roster.hasScrollBar()) {
                        if (!visible) {
                            $filter.show();
                            $type.show();
                        }
                    } else {
                        $filter.hide();
                        $type.hide();
                    }
                    return this;
                },

                reset: function () {
                    converse.roster.reset();
                    this.removeAll();
                    this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                    this.render().update();
                    return this;
                },

                registerRosterHandler: function () {
                    converse.connection.addHandler(
                        converse.roster.onRosterPush.bind(converse.roster),
                        Strophe.NS.ROSTER, 'iq', "set"
                    );
                },

                registerRosterXHandler: function () {
                    var t = 0;
                    converse.connection.addHandler(
                        function (msg) {
                            window.setTimeout(
                                function () {
                                    converse.connection.flush();
                                    converse.roster.subscribeToSuggestedItems.bind(converse.roster)(msg);
                                },
                                t
                            );
                            t += $(msg).find('item').length*250;
                            return true;
                        },
                        Strophe.NS.ROSTERX, 'message', null
                    );
                },

                registerPresenceHandler: function () {
                    converse.connection.addHandler(
                        function (presence) {
                            converse.roster.presenceHandler(presence);
                            return true;
                        }.bind(this), null, 'presence', null);
                },

                onGroupAdd: function (group) {
                    var view = new converse.RosterGroupView({model: group});
                    this.add(group.get('name'), view.render());
                    this.positionGroup(view);
                },

                onContactAdd: function (contact) {
                    this.addRosterContact(contact).update();
                    if (!contact.get('vcard_updated')) {
                        // This will update the vcard, which triggers a change
                        // request which will rerender the roster contact.
                        converse.getVCard(contact.get('jid'));
                    }
                },

                onContactChange: function (contact) {
                    this.updateChatBox(contact).update();
                    if (_.has(contact.changed, 'subscription')) {
                        if (contact.changed.subscription === 'from') {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (_.contains(['both', 'to'], contact.get('subscription'))) {
                            this.addExistingContact(contact);
                        }
                    }
                    if (_.has(contact.changed, 'ask') && contact.changed.ask === 'subscribe') {
                        this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                    }
                    if (_.has(contact.changed, 'subscription') && contact.changed.requesting === 'true') {
                        this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                    }
                    this.liveFilter();
                },

                updateChatBox: function (contact) {
                    var chatbox = converse.chatboxes.get(contact.get('jid')),
                        changes = {};
                    if (!chatbox) {
                        return this;
                    }
                    if (_.has(contact.changed, 'chat_status')) {
                        changes.chat_status = contact.get('chat_status');
                    }
                    if (_.has(contact.changed, 'status')) {
                        changes.status = contact.get('status');
                    }
                    chatbox.save(changes);
                    return this;
                },

                positionFetchedGroups: function (model, resp, options) {
                    /* Instead of throwing an add event for each group
                    * fetched, we wait until they're all fetched and then
                    * we position them.
                    * Works around the problem of positionGroup not
                    * working when all groups besides the one being
                    * positioned aren't already in inserted into the
                    * roster DOM element.
                    */
                    model.sort();
                    model.each(function (group, idx) {
                        var view = this.get(group.get('name'));
                        if (!view) {
                            view = new converse.RosterGroupView({model: group});
                            this.add(group.get('name'), view.render());
                        }
                        if (idx === 0) {
                            this.$roster.append(view.$el);
                        } else {
                            this.appendGroup(view);
                        }
                    }.bind(this));
                },

                positionGroup: function (view) {
                    /* Place the group's DOM element in the correct alphabetical
                    * position amongst the other groups in the roster.
                    */
                    var $groups = this.$roster.find('.roster-group'),
                        index = $groups.length ? this.model.indexOf(view.model) : 0;
                    if (index === 0) {
                        this.$roster.prepend(view.$el);
                    } else if (index === (this.model.length-1)) {
                        this.appendGroup(view);
                    } else {
                        $($groups.eq(index)).before(view.$el);
                    }
                    return this;
                },

                appendGroup: function (view) {
                    /* Add the group at the bottom of the roster
                    */
                    var $last = this.$roster.find('.roster-group').last();
                    var $siblings = $last.siblings('dd');
                    if ($siblings.length > 0) {
                        $siblings.last().after(view.$el);
                    } else {
                        $last.after(view.$el);
                    }
                    return this;
                },

                getGroup: function (name) {
                    /* Returns the group as specified by name.
                    * Creates the group if it doesn't exist.
                    */
                    var view =  this.get(name);
                    if (view) {
                        return view.model;
                    }
                    return this.model.create({name: name, id: b64_sha1(name)});
                },

                addContactToGroup: function (contact, name) {
                    this.getGroup(name).contacts.add(contact);
                },

                addExistingContact: function (contact) {
                    var groups;
                    if (converse.roster_groups) {
                        groups = contact.get('groups');
                        if (groups.length === 0) {
                            groups = [HEADER_UNGROUPED];
                        }
                    } else {
                        groups = [HEADER_CURRENT_CONTACTS];
                    }
                    _.each(groups, _.bind(this.addContactToGroup, this, contact));
                },

                addRosterContact: function (contact) {
                    if (contact.get('subscription') === 'both' || contact.get('subscription') === 'to') {
                        this.addExistingContact(contact);
                    } else {
                        if ((contact.get('ask') === 'subscribe') || (contact.get('subscription') === 'from')) {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (contact.get('requesting') === true) {
                            this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                        }
                    }
                    return this;
                }
            });


            converse.ControlBoxToggle = Backbone.View.extend({
                tagName: 'a',
                className: 'toggle-controlbox',
                id: 'toggle-controlbox',
                events: {
                    'click': 'onClick'
                },
                attributes: {
                    'href': "#"
                },

                initialize: function () {
                    this.render();
                },

                render: function () {
                    $('#conversejs').prepend(this.$el.html(
                        converse.templates.controlbox_toggle({
                            'label_toggle': __('Toggle chat')
                        })
                    ));
                    // We let the render method of ControlBoxView decide whether
                    // the ControlBox or the Toggle must be shown. This prevents
                    // artifacts (i.e. on page load the toggle is shown only to then
                    // seconds later be hidden in favor of the control box).
                    this.$el.hide();
                    return this;
                },

                hide: function (callback) {
                    this.$el.fadeOut('fast', callback);
                },

                show: function (callback) {
                    this.$el.show('fast', callback);
                },

                showControlBox: function () {
                    var controlbox = converse.chatboxes.get('controlbox');
                    if (!controlbox) {
                        controlbox = converse.addControlBox();
                    }
                    if (converse.connection.connected) {
                        controlbox.save({closed: false});
                    } else {
                        controlbox.trigger('show');
                    }
                },

                onClick: function (e) {
                    e.preventDefault();
                    if ($("div#controlbox").is(':visible')) {
                        var controlbox = converse.chatboxes.get('controlbox');
                        if (converse.connection.connected) {
                            controlbox.save({closed: true});
                        } else {
                            controlbox.trigger('hide');
                        }
                    } else {
                        this.showControlBox();
                    }
                }
            });
        }
    });
}));
