// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["jquery.noconflict",
            "converse-core",
            "lodash.fp",
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
            $,
            converse,
            fp,
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

    const USERS_PANEL_ID = 'users';
    const CHATBOX_TYPE = 'chatbox';
    const { Strophe, Backbone, Promise, utils, _, moment } = converse.env;


    converse.plugins.add('converse-controlbox', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            _tearDown () {
                this.__super__._tearDown.apply(this, arguments);
                if (this.rosterview) {
                    // Removes roster groups
                    this.rosterview.model.off().reset();
                    this.rosterview.each(function (groupview) {
                        groupview.removeAll();
                        groupview.remove();
                    });
                    this.rosterview.removeAll().remove();
                }
            },

            clearSession () {
                this.__super__.clearSession.apply(this, arguments);
                const controlbox = this.chatboxes.get('controlbox');
                if (controlbox &&
                        controlbox.collection &&
                        controlbox.collection.browserStorage) {
                    controlbox.save({'connected': false});
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown (chatbox) {
                    return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                           chatbox.get('id') !== 'controlbox';
                },

                onChatBoxesFetched (collection, resp) {
                    this.__super__.onChatBoxesFetched.apply(this, arguments);
                    const { _converse } = this.__super__;
                    if (!_.includes(_.map(collection, 'id'), 'controlbox')) {
                        _converse.addControlBox();
                    }
                    this.get('controlbox').save({connected:true});
                },
            },

            ChatBoxViews: {
                onChatBoxAdded (item) {
                    const { _converse } = this.__super__;
                    if (item.get('box_id') === 'controlbox') {
                        let view = this.get(item.get('id'));
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

                closeAllChatBoxes () {
                    const { _converse } = this.__super__;
                    this.each(function (view) {
                        if (view.model.get('id') === 'controlbox' &&
                                (_converse.disconnection_cause !== _converse.LOGOUT || _converse.show_controlbox_by_default)) {
                            return;
                        }
                        view.close();
                    });
                    return this;
                },

                getChatBoxWidth (view) {
                    const { _converse } = this.__super__;
                    const controlbox = this.get('controlbox');
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
                initialize () {
                    if (this.get('id') === 'controlbox') {
                        this.set({'time_opened': moment(0).valueOf()});
                    } else {
                        this.__super__.initialize.apply(this, arguments);
                    }
                },
            },

            ChatBoxView: {
                insertIntoDOM () {
                    const view = this.__super__._converse.chatboxviews.get("controlbox");
                    if (view) {
                        view.el.insertAdjacentElement('afterend', this.el)
                    } else {
                        this.__super__.insertIntoDOM.apply(this, arguments);
                    }
                    return this;
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __ } = _converse;

            _converse.api.settings.update({
                allow_logout: true,
                default_domain: undefined,
                locked_domain: undefined,
                show_controlbox_by_default: false,
                sticky_controlbox: false,
                xhr_user_search: false,
                xhr_user_search_url: ''
            });

            const LABEL_CONTACTS = __('Contacts');

            _converse.addControlBox = () => {
                _converse.chatboxes.add({
                    id: 'controlbox',
                    box_id: 'controlbox',
                    type: 'controlbox',
                    closed: !_converse.show_controlbox_by_default
                })
            };

            _converse.ControlBoxView = _converse.ChatBoxView.extend({
                tagName: 'div',
                className: 'chatbox',
                id: 'controlbox',
                events: {
                    'click a.close-chatbox-button': 'close',
                    'click ul#controlbox-tabs li a': 'switchTab',
                },

                initialize () {
                    if (_.isUndefined(_converse.controlboxtoggle)) {
                        _converse.controlboxtoggle = new _converse.ControlBoxToggle();
                        this.$el.insertAfter(_converse.controlboxtoggle.$el);
                    }
                    this.model.on('change:connected', this.onConnected, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('hide', this.hide, this);
                    this.model.on('show', this.show, this);
                    this.model.on('change:closed', this.ensureClosedState, this);
                    this.render();
                    if (this.model.get('connected')) {
                        _converse.api.waitUntil('rosterViewInitialized')
                            .then(this.insertRoster.bind(this))
                            .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    }
                },

                render () {
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
                    this.el.innerHTML = tpl_controlbox(
                        _.extend(this.model.toJSON(), {
                            'sticky_controlbox': _converse.sticky_controlbox
                        }));

                    if (!_converse.connection.connected ||
                            !_converse.connection.authenticated ||
                            _converse.connection.disconnecting) {
                        this.renderLoginPanel();
                    } else if (this.model.get('connected') &&
                            (!this.contactspanel || !this.contactspanel.$el.is(':visible'))) {
                        this.renderContactsPanel();
                    }
                    return this;
                },

                onConnected () {
                    if (this.model.get('connected')) {
                        this.render();
                        _converse.api.waitUntil('rosterViewInitialized')
                            .then(this.insertRoster.bind(this))
                            .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                        this.model.save();
                    }
                },

                insertRoster () {
                    /* Place the rosterview inside the "Contacts" panel.
                     */
                    this.contactspanel.$el.append(_converse.rosterview.$el);
                    return this;
                },

                renderLoginPanel () {
                    this.loginpanel = new _converse.LoginPanel({
                        '$parent': this.$el.find('.controlbox-panes'),
                        'model': this
                    });
                    this.loginpanel.render();
                    return this;
                },

                renderContactsPanel () {
                    if (_.isUndefined(this.model.get('active-panel'))) {
                        this.model.save({'active-panel': USERS_PANEL_ID});
                    }
                    this.contactspanel = new _converse.ContactsPanel({
                        '$parent': this.$el.find('.controlbox-panes')
                    });
                    this.contactspanel.insertIntoDOM();

                    _converse.xmppstatusview = new _converse.XMPPStatusView({
                        'model': _converse.xmppstatus
                    });
                    _converse.xmppstatusview.render();
                },

                close (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (_converse.sticky_controlbox) {
                        return;
                    }
                    if (_converse.connection.connected && !_converse.connection.disconnecting) {
                        this.model.save({'closed': true});
                    } else {
                        this.model.trigger('hide');
                    }
                    _converse.emit('controlBoxClosed', this);
                    return this;
                },

                ensureClosedState () {
                    if (this.model.get('closed')) {
                        this.hide();
                    } else {
                        this.show();
                    }
                },

                hide (callback) {
                    if (_converse.sticky_controlbox) {
                        return;
                    }
                    this.$el.addClass('hidden');
                    utils.refreshWebkit();
                    _converse.emit('chatBoxClosed', this);
                    if (!_converse.connection.connected) {
                        _converse.controlboxtoggle.render();
                    }
                    _converse.controlboxtoggle.show(callback);
                    return this;
                },

                onControlBoxToggleHidden () {
                    const that = this;
                    utils.fadeIn(this.el, function () {
                        _converse.controlboxtoggle.updateOnlineCount();
                        utils.refreshWebkit();
                        that.model.set('closed', false);
                        _converse.emit('controlBoxOpened', that);
                    });
                },

                show () {
                    _converse.controlboxtoggle.hide(
                        this.onControlBoxToggleHidden.bind(this)
                    );
                    return this;
                },

                switchTab (ev) {
                    // TODO: automatically focus the relevant input
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const $tab = $(ev.target),
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

                showHelpMessages () {
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

                initialize (cfg) {
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

                render () {
                    this.$tabs.append(tpl_login_tab({label_sign_in: __('Sign in')}));
                    this.$el.find('input#jid').focus();
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                    return this;
                },

                authenticate (ev) {
                    /* Authenticate the user based on a form submission event.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const $form = $(ev.target);
                    if (_converse.authentication === _converse.ANONYMOUS) {
                        this.connect($form, _converse.jid, null);
                        return;
                    }
                    const $jid_input = $form.find('input[name=jid]');
                    const $pw_input = $form.find('input[name=password]');
                    const password = $pw_input.val();

                    let jid = $jid_input.val(),
                        errors = false;

                    if (!jid || (
                            !_converse.locked_domain &&
                            !_converse.default_domain &&
                            _.filter(jid.split('@')).length < 2)) {
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

                connect ($form, jid, password) {
                    let resource;
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

                remove () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });


            _converse.XMPPStatusView = Backbone.View.extend({
                el: "form#set-xmpp-status",
                events: {
                    "click a.choose-xmpp-status": "toggleOptions",
                    "click #fancy-xmpp-status-select a.change-xmpp-status-message": "renderStatusChangeForm",
                    "submit": "setStatusMessage",
                    "click .dropdown dd ul li a": "setStatus"
                },

                initialize () {
                    this.model.on("change:status", this.updateStatusUI, this);
                    this.model.on("change:status_message", this.updateStatusUI, this);
                    this.model.on("update-status-ui", this.updateStatusUI, this);
                },

                render () {
                    // Replace the default dropdown with something nicer
                    const $select = this.$el.find('select#select-xmpp-status');
                    const chat_status = this.model.get('status') || 'offline';
                    const options = $('option', $select);
                    const options_list = [];
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
                    const $options_target = this.$el.find("#target dd ul").hide();
                    $options_target.append(options_list.join(''));
                    $select.remove();
                    return this;
                },

                toggleOptions (ev) {
                    ev.preventDefault();
                    utils.slideInAllElements(
                        document.querySelectorAll('#conversejs .contact-form-container')
                    );
                    $(ev.target).parent().parent().siblings('dd').find('ul').toggle('fast');
                },

                renderStatusChangeForm (ev) {
                    ev.preventDefault();
                    const status_message = _converse.xmppstatus.get('status_message') || '';
                    const input = tpl_change_status_message({
                        'status_message': status_message,
                        'label_custom_status': __('Custom status'),
                        'label_save': __('Save')
                    });
                    const $xmppstatus = this.$el.find('.xmpp-status');
                    $xmppstatus.parent().addClass('no-border');
                    $xmppstatus.replaceWith(input);
                    this.$el.find('.custom-xmpp-status').focus().focus();
                },

                setStatusMessage (ev) {
                    ev.preventDefault();
                    this.model.setStatusMessage($(ev.target).find('input').val());
                },

                setStatus (ev) {
                    ev.preventDefault();
                    const $el = $(ev.currentTarget),
                        value = $el.attr('data-value');
                    if (value === 'logout') {
                        this.$el.find(".dropdown dd ul").hide();
                        _converse.logOut();
                    } else {
                        this.model.setStatus(value);
                        this.$el.find(".dropdown dd ul").hide();
                    }
                },

                getPrettyStatus (stat) {
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

                updateStatusUI (model) {
                    const stat = model.get('status');
                    // For translators: the %1$s part gets replaced with the status
                    // Example, I am online
                    const status_message = model.get('status_message') || __("I am %1$s", this.getPrettyStatus(stat));
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

                initialize (cfg) {
                    this.parent_el = cfg.$parent[0];
                    this.tab_el = document.createElement('li');
                    _converse.chatboxes.on('change:num_unread', this.renderTab, this);
                    _converse.chatboxes.on('add', _.debounce(this.renderTab, 100), this);
                },

                render () {
                    this.renderTab();

                    let widgets = tpl_contacts_panel({
                        label_online: __('Online'),
                        label_busy: __('Busy'),
                        label_away: __('Away'),
                        label_offline: __('Offline'),
                        label_logout: __('Log out'),
                        include_offline_state: _converse.include_offline_state,
                        allow_logout: _converse.allow_logout
                    });
                    if (_converse.allow_contact_requests) {
                        widgets += tpl_add_contact_dropdown({
                            label_click_to_chat: __('Click to add new chat contacts'),
                            label_add_contact: __('Add a contact')
                        });
                    }
                    this.el.innerHTML = widgets;

                    const controlbox = _converse.chatboxes.get('controlbox');
                    if (controlbox.get('active-panel') !== USERS_PANEL_ID) {
                        this.el.classList.add('hidden');
                    }
                    return this;
                },

                renderTab () {
                    const controlbox = _converse.chatboxes.get('controlbox');
                    const chats = fp.filter(_.partial(utils.isOfType, CHATBOX_TYPE), _converse.chatboxes.models);
                    this.tab_el.innerHTML = tpl_contacts_tab({
                        'label_contacts': LABEL_CONTACTS,
                        'is_current': controlbox.get('active-panel') === USERS_PANEL_ID,
                        'num_unread': fp.sum(fp.map(fp.curry(utils.getAttribute)('num_unread'), chats))
                    });
                },

                insertIntoDOM () {
                    this.parent_el.appendChild(this.render().el);
                    this.tabs = this.parent_el.parentNode.querySelector('#controlbox-tabs');
                    this.tabs.appendChild(this.tab_el);
                    return this;
                },

                generateAddContactHTML (settings={}) {
                    if (_converse.xhr_user_search) {
                        return tpl_search_contact({
                            label_contact_name: __('Contact name'),
                            label_search: __('Search')
                        });
                    } else {
                        return tpl_add_contact_form(_.assign({
                            error_message: null,
                            label_contact_username: __('e.g. user@example.org'),
                            label_add: __('Add'),
                            value: ''
                        }, settings));
                    }
                },

                toggleContactForm (ev) {
                    ev.preventDefault();
                    this.el.querySelector('.search-xmpp div').innerHTML = this.generateAddContactHTML();
                    var dropdown = this.el.querySelector('.contact-form-container');
                    utils.slideToggleElement(dropdown).then(() => {
                        if ($(dropdown).is(':visible')) {
                            $(dropdown).find('input.username').focus();
                        }
                    });
                },

                searchContacts (ev) {
                    ev.preventDefault();
                    $.getJSON(_converse.xhr_user_search_url+ "?q=" + $(ev.target).find('input.username').val(), function (data) {
                        const $ul= $('.search-xmpp ul');
                        $ul.find('li.found-user').remove();
                        $ul.find('li.chat-info').remove();
                        if (!data.length) {
                            $ul.append(`<li class="chat-info">${__('No users found')}</li>`);
                        }
                        $(data).each(function (idx, obj) {
                            $ul.append(
                                $('<li class="found-user"></li>')
                                .append(
                                    $(`<a class="subscribe-to-user" href="#" title="${__('Click to add as a chat contact')}"></a>`)
                                    .attr('data-recipient', Strophe.getNodeFromJid(obj.id)+"@"+Strophe.getDomainFromJid(obj.id))
                                    .text(obj.fullname)
                                )
                            );
                        });
                    });
                },

                addContactFromForm (ev) {
                    ev.preventDefault();
                    const $input = $(ev.target).find('input');
                    const jid = $input.val();
                    if (!jid || _.filter(jid.split('@')).length < 2) {
                        this.el.querySelector('.search-xmpp div').innerHTML =
                            this.generateAddContactHTML({
                                error_message: __('Please enter a valid XMPP username'),
                                label_contact_username: __('e.g. user@example.org'),
                                label_add: __('Add'),
                                value: jid
                            });
                        return;
                    }
                    _converse.roster.addAndSubscribe(jid);
                    utils.slideIn(this.el.querySelector('.contact-form-container'));
                },

                addContactFromList (ev) {
                    ev.preventDefault();
                    const $target = $(ev.target),
                        jid = $target.attr('data-recipient'),
                        name = $target.text();
                    _converse.roster.addAndSubscribe(jid, name);
                    $target.parent().remove();
                    utils.slideIn(this.el.querySelector('.contact-form-container'));
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

                initialize () {
                    _converse.chatboxviews.$el.prepend(this.render().el);
                    this.updateOnlineCount();
                    const that = this;
                    _converse.api.waitUntil('initialized').then(() => {
                        _converse.roster.on("add", that.updateOnlineCount, that);
                        _converse.roster.on('change', that.updateOnlineCount, that);
                        _converse.roster.on("destroy", that.updateOnlineCount, that);
                        _converse.roster.on("remove", that.updateOnlineCount, that);
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                },

                render () {
                    // We let the render method of ControlBoxView decide whether
                    // the ControlBox or the Toggle must be shown. This prevents
                    // artifacts (i.e. on page load the toggle is shown only to then
                    // seconds later be hidden in favor of the control box).
                    this.el.innerHTML = tpl_controlbox_toggle({
                        'label_toggle': __('Toggle chat')
                    })
                    return this;
                },

                updateOnlineCount: _.debounce(function () {
                    if (_.isUndefined(_converse.roster)) {
                        return;
                    }
                    const $count = this.$('#online-count');
                    $count.text(`(${_converse.roster.getNumOnlineContacts()})`);
                    if (!$count.is(':visible')) {
                        $count.show();
                    }
                }, _converse.animate ? 100 : 0),

                hide (callback) {
                    this.el.classList.add('hidden');
                    callback();
                },

                show (callback) {
                    utils.fadeIn(this.el, callback);
                },

                showControlBox () {
                    let controlbox = _converse.chatboxes.get('controlbox');
                    if (!controlbox) {
                        controlbox = _converse.addControlBox();
                    }
                    if (_converse.connection.connected) {
                        controlbox.save({closed: false});
                    } else {
                        controlbox.trigger('show');
                    }
                },

                onClick (e) {
                    e.preventDefault();
                    if ($("div#controlbox").is(':visible')) {
                        const controlbox = _converse.chatboxes.get('controlbox');
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

            Promise.all([
                _converse.api.waitUntil('connectionInitialized'),
                _converse.api.waitUntil('chatBoxesInitialized')
            ]).then(_converse.addControlBox)
              .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));

            const disconnect =  function () {
                /* Upon disconnection, set connected to `false`, so that if
                 * we reconnect,
                 * "onConnected" will be called, to fetch the roster again and
                 * to send out a presence stanza.
                 */
                const view = _converse.chatboxviews.get('controlbox');
                view.model.set({connected:false});
                view.$('#controlbox-tabs').empty();
                view.renderLoginPanel();
            };
            _converse.on('disconnected', disconnect);

            const afterReconnected = function () {
                /* After reconnection makes sure the controlbox's is aware.
                 */
                const view = _converse.chatboxviews.get('controlbox');
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
