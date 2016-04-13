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
            // TODO: remove the next two dependencies
            "converse-rosterview",
            "converse-chatview"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
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

            onDisconnected: function () {
                var result = this._super.onDisconnected.apply(this, arguments);
                if (result === 'disconnected') {
                    converse._tearDown();
                    var view = converse.chatboxviews.get('controlbox');
                    view.model.set({connected:false});
                    view.$('#controlbox-tabs').empty();
                    view.renderLoginPanel();
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
                if (typeof this.connection !== 'undefined' && this.connection.connected) {
                    this.chatboxes.get('controlbox').save({'connected': false});
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown: function (chatbox) {
                    return this._super.chatBoxMayBeShown.apply(this, arguments) &&
                           chatbox.get('id') !== 'controlbox';
                },

                onChatBoxesFetched: function (collection, resp) {
                    this._super.onChatBoxesFetched.apply(this, arguments);
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
                    if (item.get('box_id') === 'controlbox') {
                        var view = this.get(item.get('id'));
                        if (view) {
                            view.model = item;
                            view.initialize();
                            return view;
                        } else {
                            view = new converse.ControlBoxView({model: item});
                            return this.add(item.get('id'), view);
                        }
                    } else {
                        return this._super.onChatBoxAdded.apply(this, arguments);
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


            ChatBox: {
                initialize: function () {
                    if (this.get('id') === 'controlbox') {
                        this.set({
                            'time_opened': moment(0).valueOf(),
                            'num_unread': 0
                        });
                    } else {
                        this._super.initialize.apply(this, arguments);
                    }
                },
            },


            ChatBoxView: {
                insertIntoPage: function () {
                    this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            this.updateSettings({
                allow_logout: true,
                default_domain: undefined,
                show_controlbox_by_default: false,
                sticky_controlbox: false,
                xhr_user_search: false,
                xhr_user_search_url: ''
            });

            var LABEL_CONTACTS = __('Contacts');

            converse.addControlBox = function () {
                return converse.chatboxes.add({
                    id: 'controlbox',
                    box_id: 'controlbox',
                    closed: !converse.show_controlbox_by_default
                });
            };

            converse.ControlBoxView = converse.ChatBoxView.extend({
                tagName: 'div',
                className: 'chatbox',
                id: 'controlbox',
                events: {
                    'click a.close-chatbox-button': 'close',
                    'click ul#controlbox-tabs li a': 'switchTab',
                },

                initialize: function () {
                    this.$el.insertAfter(converse.controlboxtoggle.$el);
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
                    this.$el.html(converse.templates.controlbox(
                        _.extend(this.model.toJSON(), {
                            sticky_controlbox: converse.sticky_controlbox
                        }))
                    );
                    if (!converse.connection.connected || !converse.connection.authenticated || converse.connection.disconnecting) {
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
                    this.loginpanel = new converse.LoginPanel({
                        '$parent': this.$el.find('.controlbox-panes'),
                        'model': this
                    });
                    this.loginpanel.render();
                    if ($feedback.length && $feedback.text() !== __('Connecting')) {
                        this.$('.conn-feedback').replaceWith($feedback);
                    }
                    return this;
                },

                renderContactsPanel: function () {
                    this.contactspanel = new converse.ContactsPanel({
                        '$parent': this.$el.find('.controlbox-panes')
                    });
                    this.contactspanel.render();
                    converse.xmppstatusview = new converse.XMPPStatusView({
                        'model': converse.xmppstatus
                    });
                    converse.xmppstatusview.render();
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

                onControlBoxToggleHidden: function () {
                    this.$el.show('fast', function () {
                        converse.controlboxtoggle.updateOnlineCount();
                        utils.refreshWebkit();
                        converse.emit('controlBoxOpened', this);
                    }.bind(this));
                },

                show: function () {
                    converse.controlboxtoggle.hide(
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
                            label_contact_username: __('e.g. user@example.org'),
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
                    converse.on('initialized', function () {
                        converse.roster.on("add", this.updateOnlineCount, this);
                        converse.roster.on('change', this.updateOnlineCount, this);
                        converse.roster.on("destroy", this.updateOnlineCount, this);
                        converse.roster.on("remove", this.updateOnlineCount, this);
                    }.bind(this));
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

                updateOnlineCount: _.debounce(function () {
                    if (typeof converse.roster === 'undefined') {
                        return;
                    }
                    var $count = this.$('#online-count');
                    $count.text('('+converse.roster.getNumOnlineContacts()+')');
                    if (!$count.is(':visible')) {
                        $count.show();
                    }
                }, converse.animate ? 100 : 0),

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
