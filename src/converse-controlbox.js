// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, Backbone */

(function (root, factory) {
    define(["converse-core",
            "tpl!add_contact_dropdown",
            "tpl!add_contact_form",
            "tpl!change_status_message",
            "tpl!chat_status",
            "tpl!choose_status",
            "tpl!contacts_panel",
            "tpl!contacts_tab",
            "tpl!controlbox",
            "tpl!controlbox_toggle",
            "tpl!login_panel",
            "tpl!login_tab",
            "tpl!search_contact",
            "tpl!status_option",
            "converse-chatview",
            "converse-rosterview"
    ], factory);
}(this, function (
            converse,
            tpl_add_contact_dropdown,
            tpl_add_contact_form,
            tpl_change_status_message,
            tpl_chat_status,
            tpl_choose_status,
            tpl_contacts_panel,
            tpl_contacts_tab,
            tpl_controlbox,
            tpl_controlbox_toggle,
            tpl_login_panel,
            tpl_login_tab,
            tpl_search_contact,
            tpl_status_option
        ) {
    "use strict";

    var USERS_PANEL_ID = 'users';
    // Strophe methods for building stanzas
    var Strophe = converse.env.Strophe,
        utils = converse.env.utils;
    // Other necessary globals
    var $ = converse.env.jQuery,
        _ = converse.env._,
        moment = converse.env.moment;


    converse.plugins.add('converse-controlbox', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            initSession: function () {
                this.controlboxtoggle = new this.ControlBoxToggle();
                this.__super__.initSession.apply(this, arguments);
            },

            initConnection: function () {
                this.__super__.initConnection.apply(this, arguments);
                if (this.connection) {
                    this.addControlBox();
                }
            },

            _tearDown: function () {
                this.__super__._tearDown.apply(this, arguments);
                if (this.rosterview) {
                    this.rosterview.unregisterHandlers();
                    // Removes roster groups
                    this.rosterview.model.off().reset();
                    this.rosterview.each(function (groupview) {
                        groupview.removeAll();
                        groupview.remove();
                    });
                    this.rosterview.removeAll().remove();
                }
            },

            clearSession: function () {
                this.__super__.clearSession.apply(this, arguments);
                if (_.isUndefined(this.connection) && this.connection.connected) {
                    this.chatboxes.get('controlbox').save({'connected': false});
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown: function (chatbox) {
                    return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                           chatbox.get('id') !== 'controlbox';
                },

                onChatBoxesFetched: function (collection, resp) {
                    var _converse = this.__super__._converse;
                    this.__super__.onChatBoxesFetched.apply(this, arguments);
                    if (!_.includes(_.map(collection, 'id'), 'controlbox')) {
                        _converse.addControlBox();
                    }
                    this.get('controlbox').save({connected:true});
                },
            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var _converse = this.__super__._converse;
                    if (item.get('box_id') === 'controlbox') {
                        var view = this.get(item.get('id'));
                        if (view) {
                            view.model = item;
                            view.initialize();
                            return view;
                        } else {
                            view = new _converse.ControlBoxView({model: item});
                            return this.add(item.get('id'), view);
                        }
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                },

                closeAllChatBoxes: function () {
                    var _converse = this.__super__._converse;
                    this.each(function (view) {
                        if (view.model.get('id') === 'controlbox' &&
                                (_converse.disconnection_cause !== _converse.LOGOUT || _converse.show_controlbox_by_default)) {
                            return;
                        }
                        view.close();
                    });
                    return this;
                },

                getChatBoxWidth: function (view) {
                    var _converse = this.__super__._converse;
                    var controlbox = this.get('controlbox');
                    if (view.model.get('id') === 'controlbox') {
                        /* We return the width of the controlbox or its toggle,
                         * depending on which is visible.
                         */
                        if (!controlbox || !controlbox.$el.is(':visible')) {
                            return _converse.controlboxtoggle.$el.outerWidth(true);
                        } else {
                            return controlbox.$el.outerWidth(true);
                        }
                    } else {
                        return this.__super__.getChatBoxWidth.apply(this, arguments);
                    }
                }
            },


            ChatBox: {
                initialize: function () {
                    if (this.get('id') === 'controlbox') {
                        this.set({
                            'time_opened': moment(0).valueOf(),
                            'num_unread': 0
                        });
                    } else {
                        this.__super__.initialize.apply(this, arguments);
                    }
                },
            },


            ChatBoxView: {
                insertIntoDOM: function () {
                    var _converse = this.__super__._converse;
                    this.$el.insertAfter(_converse.chatboxviews.get("controlbox").$el);
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            this.updateSettings({
                allow_logout: true,
                default_domain: undefined,
                show_controlbox_by_default: false,
                sticky_controlbox: false,
                xhr_user_search: false,
                xhr_user_search_url: ''
            });

            var LABEL_CONTACTS = __('Contacts');

            _converse.addControlBox = function () {
                return _converse.chatboxes.add({
                    id: 'controlbox',
                    box_id: 'controlbox',
                    closed: !_converse.show_controlbox_by_default
                });
            };

            _converse.ControlBoxView = _converse.ChatBoxView.extend({
                tagName: 'div',
                className: 'chatbox',
                id: 'controlbox',
                events: {
                    'click a.close-chatbox-button': 'close',
                    'click ul#controlbox-tabs li a': 'switchTab',
                },

                initialize: function () {
                    this.$el.insertAfter(_converse.controlboxtoggle.$el);
                    this.model.on('change:connected', this.onConnected, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('hide', this.hide, this);
                    this.model.on('show', this.show, this);
                    this.model.on('change:closed', this.ensureClosedState, this);
                    this.render();
                    if (this.model.get('connected')) {
                        this.insertRoster();
                    }
                },

                render: function () {
                    if (this.model.get('connected')) {
                        if (_.isUndefined(this.model.get('closed'))) {
                            this.model.set('closed', !_converse.show_controlbox_by_default);
                        }
                    }
                    if (!this.model.get('closed')) {
                        this.show();
                    } else {
                        this.hide();
                    }
                    this.$el.html(tpl_controlbox(
                        _.extend(this.model.toJSON(), {
                            sticky_controlbox: _converse.sticky_controlbox
                        }))
                    );
                    if (!_converse.connection.connected || !_converse.connection.authenticated || _converse.connection.disconnecting) {
                        this.renderLoginPanel();
                    } else if (!this.contactspanel || !this.contactspanel.$el.is(':visible')) {
                        this.renderContactsPanel();
                    }
                    return this;
                },

                onConnected: function () {
                    if (this.model.get('connected')) {
                        this.render().insertRoster();
                        this.model.save();
                    }
                },

                insertRoster: function () {
                    /* Place the rosterview inside the "Contacts" panel.
                     */
                    this.contactspanel.$el.append(_converse.rosterview.$el);
                    return this;
                },

                renderLoginPanel: function () {
                    this.loginpanel = new _converse.LoginPanel({
                        '$parent': this.$el.find('.controlbox-panes'),
                        'model': this
                    });
                    this.loginpanel.render();
                    return this;
                },

                renderContactsPanel: function () {
                    if (_.isUndefined(this.model.get('active-panel'))) {
                        this.model.save({'active-panel': USERS_PANEL_ID});
                    }
                    this.contactspanel = new _converse.ContactsPanel({
                        '$parent': this.$el.find('.controlbox-panes')
                    });
                    this.contactspanel.render();
                    _converse.xmppstatusview = new _converse.XMPPStatusView({
                        'model': _converse.xmppstatus
                    });
                    _converse.xmppstatusview.render();
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (_converse.connection.connected && !_converse.connection.disconnecting) {
                        this.model.save({'closed': true});
                    } else {
                        this.model.trigger('hide');
                    }
                    _converse.emit('controlBoxClosed', this);
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
                    this.$el.addClass('hidden');
                    utils.refreshWebkit();
                    _converse.emit('chatBoxClosed', this);
                    if (!_converse.connection.connected) {
                        _converse.controlboxtoggle.render();
                    }
                    _converse.controlboxtoggle.show(callback);
                    return this;
                },

                onControlBoxToggleHidden: function () {
                    var that = this;
                    utils.fadeIn(this.el, function () {
                        _converse.controlboxtoggle.updateOnlineCount();
                        utils.refreshWebkit();
                        that.model.set('closed', false);
                        _converse.emit('controlBoxOpened', that);
                    });
                },

                show: function () {
                    _converse.controlboxtoggle.hide(
                        this.onControlBoxToggleHidden.bind(this)
                    );
                    return this;
                },

                switchTab: function (ev) {
                    // TODO: automatically focus the relevant input
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $tab = $(ev.target),
                        $sibling = $tab.parent().siblings('li').children('a'),
                        $tab_panel = $($tab.attr('href'));
                    $($sibling.attr('href')).addClass('hidden');
                    $sibling.removeClass('current');
                    $tab.addClass('current');
                    $tab_panel.removeClass('hidden');
                    if (!_.isUndefined(_converse.chatboxes.browserStorage)) {
                        this.model.save({'active-panel': $tab.data('id')});
                    }
                    return this;
                },

                showHelpMessages: function () {
                    /* Override showHelpMessages in ChatBoxView, for now do nothing.
                     *
                     * Parameters:
                     *  (Array) msgs: Array of messages
                     */
                    return;
                }
            });


            _converse.LoginPanel = Backbone.View.extend({
                tagName: 'div',
                id: "login-dialog",
                className: 'controlbox-pane',
                events: {
                    'submit form#converse-login': 'authenticate'
                },

                initialize: function (cfg) {
                    cfg.$parent.html(this.$el.html(
                        tpl_login_panel({
                            'ANONYMOUS': _converse.ANONYMOUS,
                            'EXTERNAL': _converse.EXTERNAL,
                            'LOGIN': _converse.LOGIN,
                            'PREBIND': _converse.PREBIND,
                            'auto_login': _converse.auto_login,
                            'authentication': _converse.authentication,
                            'label_username': __('XMPP Username:'),
                            'label_password': __('Password:'),
                            'label_anon_login': __('Click here to log in anonymously'),
                            'label_login': __('Log In'),
                            'placeholder_username': (_converse.locked_domain || _converse.default_domain) && __('Username') || __('user@server'),
                            'placeholder_password': __('password')
                        })
                    ));
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                },

                render: function () {
                    this.$tabs.append(tpl_login_tab({label_sign_in: __('Sign in')}));
                    this.$el.find('input#jid').focus();
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                    return this;
                },

                authenticate: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $form = $(ev.target);
                    if (_converse.authentication === _converse.ANONYMOUS) {
                        this.connect($form, _converse.jid, null);
                        return;
                    }
                    var $jid_input = $form.find('input[name=jid]'),
                        jid = $jid_input.val(),
                        $pw_input = $form.find('input[name=password]'),
                        password = $pw_input.val(),
                        errors = false;

                    if (!jid) {
                        errors = true;
                        $jid_input.addClass('error');
                    }
                    if (!password && _converse.authentication !== _converse.EXTERNAL)  {
                        errors = true;
                        $pw_input.addClass('error');
                    }
                    if (errors) { return; }
                    if (_converse.locked_domain) {
                        jid = Strophe.escapeNode(jid) + '@' + _converse.locked_domain;
                    } else if (_converse.default_domain && !_.includes(jid, '@')) {
                        jid = jid + '@' + _converse.default_domain;
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
                            jid = jid.toLowerCase() + _converse.generateResource();
                        } else {
                            jid = Strophe.getBareJidFromJid(jid).toLowerCase()+'/'+resource;
                        }
                    }
                    _converse.connection.reset();
                    _converse.connection.connect(jid, password, _converse.onConnectStatusChanged);
                },

                remove: function () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });


            _converse.XMPPStatusView = Backbone.View.extend({
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
                    this.$el.html(tpl_choose_status());
                    this.$el.find('#fancy-xmpp-status-select')
                            .html(tpl_chat_status({
                                'status_message': this.model.get('status_message') || __("I am %1$s", this.getPrettyStatus(chat_status)),
                                'chat_status': chat_status,
                                'desc_custom_status': __('Click here to write a custom status message'),
                                'desc_change_status': __('Click to change your chat status')
                                }));
                    // iterate through all the <option> elements and add option values
                    options.each(function () {
                        options_list.push(tpl_status_option({
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
                    var status_message = _converse.xmppstatus.get('status_message') || '';
                    var input = tpl_change_status_message({
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
                        _converse.logOut();
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
                        tpl_chat_status({
                            'chat_status': stat,
                            'status_message': status_message,
                            'desc_custom_status': __('Click here to write a custom status message'),
                            'desc_change_status': __('Click to change your chat status')
                        }));
                }
            });


            _converse.ContactsPanel = Backbone.View.extend({
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
                    var widgets = tpl_contacts_panel({
                        label_online: __('Online'),
                        label_busy: __('Busy'),
                        label_away: __('Away'),
                        label_offline: __('Offline'),
                        label_logout: __('Log out'),
                        include_offline_state: _converse.include_offline_state,
                        allow_logout: _converse.allow_logout
                    });
                    var controlbox = _converse.chatboxes.get('controlbox');
                    this.$tabs.append(tpl_contacts_tab({
                        'label_contacts': LABEL_CONTACTS,
                        'is_current': controlbox.get('active-panel') === USERS_PANEL_ID
                    }));
                    if (_converse.xhr_user_search) {
                        markup = tpl_search_contact({
                            label_contact_name: __('Contact name'),
                            label_search: __('Search')
                        });
                    } else {
                        markup = tpl_add_contact_form({
                            label_contact_username: __('e.g. user@example.org'),
                            label_add: __('Add')
                        });
                    }
                    if (_converse.allow_contact_requests) {
                        widgets += tpl_add_contact_dropdown({
                            label_click_to_chat: __('Click to add new chat contacts'),
                            label_add_contact: __('Add a contact')
                        });
                    }
                    this.$el.html(widgets);
                    this.$el.find('.search-xmpp ul').append(markup);
                    if (controlbox.get('active-panel') !== USERS_PANEL_ID) {
                        this.$el.addClass('hidden');
                    }
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
                    $.getJSON(_converse.xhr_user_search_url+ "?q=" + $(ev.target).find('input.username').val(), function (data) {
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
                    _converse.roster.addAndSubscribe(jid);
                    $('.search-xmpp').hide();
                },

                addContactFromList: function (ev) {
                    ev.preventDefault();
                    var $target = $(ev.target),
                        jid = $target.attr('data-recipient'),
                        name = $target.text();
                    _converse.roster.addAndSubscribe(jid, name);
                    $target.parent().remove();
                    $('.search-xmpp').hide();
                }
            });


            _converse.ControlBoxToggle = Backbone.View.extend({
                tagName: 'a',
                className: 'toggle-controlbox hidden',
                id: 'toggle-controlbox',
                events: {
                    'click': 'onClick'
                },
                attributes: {
                    'href': "#"
                },

                initialize: function () {
                    _converse.chatboxviews.$el.prepend(this.render());
                    this.updateOnlineCount();
                    var that = this;
                    _converse.on('initialized', function () {
                        _converse.roster.on("add", that.updateOnlineCount, that);
                        _converse.roster.on('change', that.updateOnlineCount, that);
                        _converse.roster.on("destroy", that.updateOnlineCount, that);
                        _converse.roster.on("remove", that.updateOnlineCount, that);
                    });
                },

                render: function () {
                    // We let the render method of ControlBoxView decide whether
                    // the ControlBox or the Toggle must be shown. This prevents
                    // artifacts (i.e. on page load the toggle is shown only to then
                    // seconds later be hidden in favor of the control box).
                    return this.$el.html(
                        tpl_controlbox_toggle({
                            'label_toggle': __('Toggle chat')
                        })
                    );
                },

                updateOnlineCount: _.debounce(function () {
                    if (_.isUndefined(_converse.roster)) {
                        return;
                    }
                    var $count = this.$('#online-count');
                    $count.text('('+_converse.roster.getNumOnlineContacts()+')');
                    if (!$count.is(':visible')) {
                        $count.show();
                    }
                }, _converse.animate ? 100 : 0),

                hide: function (callback) {
                    this.el.classList.add('hidden');
                    callback();
                },

                show: function (callback) {
                    utils.fadeIn(this.el, callback);
                },

                showControlBox: function () {
                    var controlbox = _converse.chatboxes.get('controlbox');
                    if (!controlbox) {
                        controlbox = _converse.addControlBox();
                    }
                    if (_converse.connection.connected) {
                        controlbox.save({closed: false});
                    } else {
                        controlbox.trigger('show');
                    }
                },

                onClick: function (e) {
                    e.preventDefault();
                    if ($("div#controlbox").is(':visible')) {
                        var controlbox = _converse.chatboxes.get('controlbox');
                        if (_converse.connection.connected) {
                            controlbox.save({closed: true});
                        } else {
                            controlbox.trigger('hide');
                        }
                    } else {
                        this.showControlBox();
                    }
                }
            });

            var disconnect =  function () {
                /* Upon disconnection, set connected to `false`, so that if
                 * we reconnect,
                 * "onConnected" will be called, to fetch the roster again and
                 * to send out a presence stanza.
                 */
                var view = _converse.chatboxviews.get('controlbox');
                view.model.set({connected:false});
                view.$('#controlbox-tabs').empty();
                view.renderLoginPanel();
            };
            _converse.on('disconnected', disconnect);

            var afterReconnected = function () {
                /* After reconnection makes sure the controlbox's is aware.
                 */
                var view = _converse.chatboxviews.get('controlbox');
                if (view.model.get('connected')) {
                    _converse.chatboxviews.get("controlbox").onConnected();
                } else {
                    view.model.set({connected:true});
                }
            };
            _converse.on('reconnected', afterReconnected);
        }
    });
}));
