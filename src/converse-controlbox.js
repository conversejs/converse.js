// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["converse-core",
            "bootstrap",
            "lodash.fp",
            "tpl!converse_brand_heading",
            "tpl!controlbox",
            "tpl!controlbox_toggle",
            "tpl!login_panel",
            "converse-chatview",
            "converse-rosterview",
            "converse-profile"
    ], factory);
}(this, function (
            converse,
            bootstrap,
            fp,
            tpl_brand_heading,
            tpl_controlbox,
            tpl_controlbox_toggle,
            tpl_login_panel
        ) {
    "use strict";

    const CHATBOX_TYPE = 'chatbox';
    const { Strophe, Backbone, Promise, _, moment } = converse.env;
    const u = converse.env.utils;

    const CONNECTION_STATUS_CSS_CLASS = {
       'Error': 'error',
       'Connecting': 'info',
       'Connection failure': 'error',
       'Authenticating': 'info',
       'Authentication failure': 'error',
       'Connected': 'info',
       'Disconnected': 'error',
       'Disconnecting': 'warn',
       'Attached': 'info',
       'Redirect': 'info',
       'Reconnecting': 'warn'
    };

    const PRETTY_CONNECTION_STATUS = {
        0: 'Error',
        1: 'Connecting',
        2: 'Connection failure',
        3: 'Authenticating',
        4: 'Authentication failure',
        5: 'Connected',
        6: 'Disconnected',
        7: 'Disconnecting',
        8: 'Attached',
        9: 'Redirect',
       10: 'Reconnecting'
    };

    const REPORTABLE_STATUSES = [
        0, // ERROR'
        1, // CONNECTING
        2, // CONNFAIL
        3, // AUTHENTICATING
        4, // AUTHFAIL
        7, // DISCONNECTING
       10  // RECONNECTING
    ];

    converse.plugins.add('converse-controlbox', {
        /* Plugin dependencies are other plugins which might be
         * overridden or relied upon, and therefore need to be loaded before
         * this plugin.
         *
         * If the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found. By default it's
         * false, which means these plugins are only loaded opportunistically.
         *
         * NB: These plugins need to have already been loaded via require.js.
         */
        dependencies: ["converse-modal", "converse-chatboxes", "converse-rosterview", "converse-chatview"],

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
                const chatboxes = _.get(this, 'chatboxes', null);
                if (!_.isNil(chatboxes)) {
                    const controlbox = chatboxes.get('controlbox');
                    if (controlbox &&
                            controlbox.collection &&
                            controlbox.collection.browserStorage) {
                        controlbox.save({'connected': false});
                    }
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown (chatbox) {
                    return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                           chatbox.get('id') !== 'controlbox';
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
                        if (!controlbox || !u.isVisible(controlbox.el)) {
                            return u.getOuterWidth(_converse.controlboxtoggle.el, true);
                        } else {
                            return u.getOuterWidth(controlbox.el, true);
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
                sticky_controlbox: false
            });

            _converse.api.promises.add('controlboxInitialized');

            const LABEL_CONTACTS = __('Contacts');

            _converse.addControlBox = () =>
                _converse.chatboxes.add({
                    id: 'controlbox',
                    box_id: 'controlbox',
                    type: 'controlbox',
                    closed: !_converse.show_controlbox_by_default
                })


            _converse.ControlBoxView = _converse.ChatBoxView.extend({
                tagName: 'div',
                className: 'chatbox',
                id: 'controlbox',
                events: {
                    'click a.close-chatbox-button': 'close'
                },

                initialize () {
                    if (_.isUndefined(_converse.controlboxtoggle)) {
                        _converse.controlboxtoggle = new _converse.ControlBoxToggle();
                    }
                    _converse.controlboxtoggle.el.insertAdjacentElement('afterend', this.el);

                    this.model.on('change:connected', this.onConnected, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('hide', this.hide, this);
                    this.model.on('show', this.show, this);
                    this.model.on('change:closed', this.ensureClosedState, this);
                    this.render();
                    if (this.model.get('connected')) {
                        this.insertRoster();
                    }
                    _converse.emit('controlboxInitialized', this);
                },

                render () {
                    if (this.model.get('connected')) {
                        if (_.isUndefined(this.model.get('closed'))) {
                            this.model.set('closed', !_converse.show_controlbox_by_default);
                        }
                    }
                    this.el.innerHTML = tpl_controlbox(_.extend(this.model.toJSON()));

                    if (!this.model.get('closed')) {
                        this.show();
                    } else {
                        this.hide();
                    }
                    if (!_converse.connection.connected ||
                            !_converse.connection.authenticated ||
                            _converse.connection.disconnecting) {
                        this.renderLoginPanel();
                    } else if (this.model.get('connected') &&
                            (!this.controlbox_pane || !u.isVisible(this.controlbox_pane.el))) {
                        this.renderControlBoxPane();
                    }
                    return this;
                },

                onConnected () {
                    if (this.model.get('connected')) {
                        this.render();
                        this.insertRoster();
                    }
                },

                insertRoster () {
                    /* Place the rosterview inside the "Contacts" panel. */
                    _converse.api.waitUntil('rosterViewInitialized')
                        .then(() => this.controlbox_pane.el.insertAdjacentElement('beforeEnd', _converse.rosterview.el))
                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                },

                 createBrandHeadingHTML () {
                    return tpl_brand_heading({
                        'sticky_controlbox': _converse.sticky_controlbox
                    });
                },

                insertBrandHeading () {
                    const heading_el = this.el.querySelector('.brand-heading-container');
                    if (_.isNull(heading_el)) {
                        const el = this.el.querySelector('.controlbox-head');
                        el.insertAdjacentHTML('beforeend', this.createBrandHeadingHTML());
                    } else {
                        heading_el.outerHTML = this.createBrandHeadingHTML();
                    }
                },

                renderLoginPanel () {
                    this.el.classList.add("logged-out");
                    if (_.isNil(this.loginpanel)) {
                        this.loginpanel = new _converse.LoginPanel({
                            'model': new _converse.LoginPanelModel()
                        });
                        const panes = this.el.querySelector('.controlbox-panes');
                        panes.innerHTML = '';
                        panes.appendChild(this.loginpanel.render().el);
                        this.insertBrandHeading();
                    } else {
                        this.loginpanel.render();
                    }
                    return this;
                },

                renderControlBoxPane () {
                    /* Renders the "Contacts" panel of the controlbox.
                     *
                     * This will only be called after the user has already been
                     * logged in.
                     */
                    if (this.loginpanel) {
                        this.loginpanel.remove();
                        delete this.loginpanel;
                    }
                    this.el.classList.remove("logged-out");
                    this.controlbox_pane = new _converse.ControlBoxPane();
                    this.el.querySelector('.controlbox-panes').insertAdjacentElement(
                        'afterBegin',
                        this.controlbox_pane.el
                    )
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
                    u.addClass('hidden', this.el);
                    _converse.emit('chatBoxClosed', this);
                    if (!_converse.connection.connected) {
                        _converse.controlboxtoggle.render();
                    }
                    _converse.controlboxtoggle.show(callback);
                    return this;
                },

                onControlBoxToggleHidden () {
                    this.model.set('closed', false);
                    this.el.classList.remove('hidden');
                    _converse.emit('controlBoxOpened', this);
                },

                show () {
                    _converse.controlboxtoggle.hide(
                        this.onControlBoxToggleHidden.bind(this)
                    );
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

            _converse.LoginPanelModel = Backbone.Model.extend({
                defaults: {
                    // Passed-by-reference. Fine in this case because there's
                    // only one such model.
                    'errors': [],
                }
            });

            _converse.LoginPanel = Backbone.VDOMView.extend({
                tagName: 'div',
                id: "converse-login-panel",
                className: 'controlbox-pane fade-in',
                events: {
                    'submit form#converse-login': 'authenticate',
                    'change input': 'validate'
                },

                initialize (cfg) {
                    this.model.on('change', this.render, this);
                    this.listenTo(_converse.connfeedback, 'change', this.render);
                    this.render();
                    _.forEach(this.el.querySelectorAll('[data-title]'), (el) => {
                        const popover = new bootstrap.Popover(el, {
                            'trigger': _converse.view_mode === 'mobile' && 'click' || 'hover',
                            'dismissible': _converse.view_mode === 'mobile' && true || false,
                            'container': _converse.chatboxviews.el
                        })
                    });
                },

                toHTML () {
                    const connection_status = _converse.connfeedback.get('connection_status');
                    let feedback_class, pretty_status;
                    if (_.includes(REPORTABLE_STATUSES, connection_status)) {
                        pretty_status = PRETTY_CONNECTION_STATUS[connection_status];
                        feedback_class = CONNECTION_STATUS_CSS_CLASS[pretty_status];
                    }
                    return tpl_login_panel(
                        _.extend(this.model.toJSON(), {
                            '__': __,
                            '_converse': _converse,
                            'ANONYMOUS': _converse.ANONYMOUS,
                            'EXTERNAL': _converse.EXTERNAL,
                            'LOGIN': _converse.LOGIN,
                            'PREBIND': _converse.PREBIND,
                            'auto_login': _converse.auto_login,
                            'authentication': _converse.authentication,
                            'connection_status': connection_status,
                            'conn_feedback_class': feedback_class,
                            'conn_feedback_subject': pretty_status,
                            'conn_feedback_message': _converse.connfeedback.get('message'),
                            'placeholder_username': (_converse.locked_domain || _converse.default_domain) &&
                                                    __('Username') || __('user@domain'),
                        })
                    );
                },

                validate () {
                    const form = this.el.querySelector('form');
                    const jid_element = form.querySelector('input[name=jid]');
                    if (jid_element.value &&
                            !_converse.locked_domain &&
                            !_converse.default_domain &&
                            !u.isValidJID(jid_element.value)) {
                        jid_element.setCustomValidity(__('Please enter a valid XMPP address'));
                        return false;
                    }
                    jid_element.setCustomValidity('');
                    return true;
                },

                authenticate (ev) {
                    /* Authenticate the user based on a form submission event.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (_converse.authentication === _converse.ANONYMOUS) {
                        this.connect(_converse.jid, null);
                        return;
                    }
                    if (!this.validate()) { return; }

                    const form_data = new FormData(ev.target);
                    _converse.trusted = form_data.get('trusted');
                    _converse.storage = form_data.get('trusted') ? 'local' : 'session';

                    let jid = form_data.get('jid');
                    if (_converse.locked_domain) {
                        jid = Strophe.escapeNode(jid) + '@' + _converse.locked_domain;
                    } else if (_converse.default_domain && !_.includes(jid, '@')) {
                        jid = jid + '@' + _converse.default_domain;
                    }
                    this.connect(jid, form_data.get('password'));
                },

                connect (jid, password) {
                    if (jid) {
                        const resource = Strophe.getResourceFromJid(jid);
                        if (!resource) {
                            jid = jid.toLowerCase() + _converse.generateResource();
                        } else {
                            jid = Strophe.getBareJidFromJid(jid).toLowerCase()+'/'+resource;
                        }
                    }
                    if (_.includes(["converse/login", "converse/register"],
                            Backbone.history.getFragment())) {
                        _converse.router.navigate('', {'replace': true});
                    }
                    _converse.connection.reset();
                    _converse.connection.connect(jid, password, _converse.onConnectStatusChanged);
                }
            });


            _converse.ControlBoxPane = Backbone.NativeView.extend({
                tagName: 'div',
                className: 'controlbox-pane',

                initialize () {
                    _converse.xmppstatusview = new _converse.XMPPStatusView({
                        'model': _converse.xmppstatus
                    });
                    this.el.insertAdjacentElement(
                        'afterBegin',
                        _converse.xmppstatusview.render().el
                    );
                }
            });


            _converse.ControlBoxToggle = Backbone.NativeView.extend({
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
                    _converse.chatboxviews.insertRowColumn(this.render().el);
                    _converse.api.waitUntil('initialized')
                        .then(this.render.bind(this))
                        .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                },

                render () {
                    // We let the render method of ControlBoxView decide whether
                    // the ControlBox or the Toggle must be shown. This prevents
                    // artifacts (i.e. on page load the toggle is shown only to then
                    // seconds later be hidden in favor of the control box).
                    this.el.innerHTML = tpl_controlbox_toggle({
                        'label_toggle': _converse.connection.connected ? __('Chat Contacts') : __('Toggle chat')
                    })
                    return this;
                },

                hide (callback) {
                    u.hideElement(this.el);
                    callback();
                },

                show (callback) {
                    u.fadeIn(this.el, callback);
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
                    if (u.isVisible(_converse.root.querySelector("#controlbox"))) {
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
            ]).then(_converse.addControlBox).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));

            _converse.on('chatBoxesFetched', () => {
                const controlbox = _converse.chatboxes.get('controlbox') || _converse.addControlBox();
                controlbox.save({connected:true});
            });

            const disconnect =  function () {
                /* Upon disconnection, set connected to `false`, so that if
                 * we reconnect, "onConnected" will be called,
                 * to fetch the roster again and to send out a presence stanza.
                 */
                const view = _converse.chatboxviews.get('controlbox');
                view.model.set({'connected': false});
                view.renderLoginPanel();
            };
            _converse.on('disconnected', disconnect);
            _converse.on('will-reconnect', disconnect);
        }
    });
}));
