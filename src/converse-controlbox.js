// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-controlbox
 */
import "converse-chatview";
import "formdata-polyfill";
import bootstrap from "bootstrap.native";
import converse from "@converse/headless/converse-core";
import { get } from "lodash";
import tpl_brand_heading from "templates/converse_brand_heading.html";
import tpl_controlbox from "templates/controlbox.html";
import tpl_controlbox_toggle from "templates/controlbox_toggle.html";
import tpl_login_panel from "templates/login_panel.html";

const { Strophe, Backbone, dayjs } = converse.env;
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

    enabled (_converse) {
        return !_converse.singleton;
    },

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.

        ChatBoxes: {
            model (attrs, options) {
                const { _converse } = this.__super__;
                if (attrs.id == 'controlbox') {
                    return new _converse.ControlBox(attrs, options);
                } else {
                    return this.__super__.model.apply(this, arguments);
                }
            }
        },

        ChatBoxViews: {
            closeAllChatBoxes () {
                const { _converse } = this.__super__;
                this.forEach(function (view) {
                    if (view.model.get('id') === 'controlbox' &&
                            (_converse.disconnection_cause !== _converse.LOGOUT || _converse.show_controlbox_by_default)) {
                        return;
                    }
                    view.close();
                });
                return this;
            }
        },

        ChatBox: {
            validate (attrs) {
                const { _converse } = this.__super__;
                if (attrs.type === _converse.CONTROLBOX_TYPE) {
                    if (_converse.view_mode === 'embedded' && _converse.singleton)  {
                        return 'Controlbox not relevant in embedded view mode';
                    }
                    return;
                }
                return this.__super__.validate.apply(this, arguments);
            },

            maybeShow (force) {
                if (!force && this.get('id') === 'controlbox') {
                   // Must return the chatbox
                   return this;
                }
                return this.__super__.maybeShow.apply(this, arguments);
            },

            initialize () {
                if (this.get('id') === 'controlbox') {
                    this.set({'time_opened': dayjs(0).valueOf()});
                } else {
                    this.__super__.initialize.apply(this, arguments);
                }
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

        _converse.api.promises.add('controlBoxInitialized');

        const addControlBox = () => _converse.chatboxes.add({'id': 'controlbox'});

        _converse.ControlBox = _converse.ChatBox.extend({

            defaults () {
                return {
                    'bookmarked': false,
                    'box_id': 'controlbox',
                    'chat_state': undefined,
                    'closed': !_converse.show_controlbox_by_default,
                    'num_unread': 0,
                    'time_opened': this.get('time_opened') || (new Date()).getTime(),
                    'type': _converse.CONTROLBOX_TYPE,
                    'url': ''
                }
            },

           onReconnection: function onReconnection () {}
        });


        _converse.ControlBoxView = _converse.ChatBoxView.extend({
            tagName: 'div',
            className: 'chatbox',
            id: 'controlbox',
            events: {
                'click a.close-chatbox-button': 'close'
            },

            initialize () {
                if (_converse.controlboxtoggle === undefined) {
                    _converse.controlboxtoggle = new _converse.ControlBoxToggle();
                }
                _converse.controlboxtoggle.el.insertAdjacentElement('afterend', this.el);

                this.listenTo(this.model, 'change:connected', this.onConnected)
                this.listenTo(this.model, 'destroy', this.hide)
                this.listenTo(this.model, 'hide', this.hide)
                this.listenTo(this.model, 'show', this.show)
                this.listenTo(this.model, 'change:closed', this.ensureClosedState)
                this.render();
                /**
                 * Triggered when the _converse.ControlBoxView has been initialized and therefore
                 * exists. The controlbox contains the login and register forms when the user is
                 * logged out and a list of the user's contacts and group chats when logged in.
                 * @event _converse#controlBoxInitialized
                 * @type { _converse.ControlBoxView }
                 * @example _converse.api.listen.on('controlBoxInitialized', view => { ... });
                 */
                _converse.api.trigger('controlBoxInitialized', this);
                _converse.api.trigger('chatBoxInitialized', this);
            },

            render () {
                if (this.model.get('connected')) {
                    if (this.model.get('closed') === undefined) {
                        this.model.set('closed', !_converse.show_controlbox_by_default);
                    }
                }
                this.el.innerHTML = tpl_controlbox(Object.assign(this.model.toJSON()));

                if (!this.model.get('closed')) {
                    this.show();
                } else {
                    this.hide();
                }
                if (!_converse.connection.connected ||
                        !_converse.connection.authenticated ||
                        _converse.connection.disconnecting) {
                    this.renderLoginPanel();
                } else if (this.model.get('connected')) {
                    this.renderControlBoxPane();
                }
                return this;
            },

            onConnected () {
                if (this.model.get('connected')) {
                    this.render();
                }
            },

             createBrandHeadingHTML () {
                return tpl_brand_heading({
                    'sticky_controlbox': _converse.sticky_controlbox
                });
            },

            insertBrandHeading () {
                const heading_el = this.el.querySelector('.brand-heading-container');
                if (heading_el === null) {
                    const el = this.el.querySelector('.controlbox-head');
                    el.insertAdjacentHTML('beforeend', this.createBrandHeadingHTML());
                } else {
                    heading_el.outerHTML = this.createBrandHeadingHTML();
                }
            },

            renderLoginPanel () {
                this.el.classList.add("logged-out");
                if (this.loginpanel) {
                    this.loginpanel.render();
                } else {
                    this.loginpanel = new _converse.LoginPanel({
                        'model': new _converse.LoginPanelModel()
                    });
                    const panes = this.el.querySelector('.controlbox-panes');
                    panes.innerHTML = '';
                    panes.appendChild(this.loginpanel.render().el);
                    this.insertBrandHeading();
                }
                this.loginpanel.initPopovers();
                return this;
            },

            /**
             * Renders the "Contacts" panel of the controlbox.
             * This will only be called after the user has already been logged in.
             * @private
             * @method _converse.ControlBoxView.renderControlBoxPane
             */
            renderControlBoxPane () {
                if (this.loginpanel) {
                    this.loginpanel.remove();
                    delete this.loginpanel;
                }
                if (this.controlbox_pane && u.isVisible(this.controlbox_pane.el)) {
                    return;
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
                _converse.api.trigger('controlBoxClosed', this);
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
                _converse.api.trigger('chatBoxClosed', this);
                if (!_converse.connection.connected) {
                    _converse.controlboxtoggle.render();
                }
                _converse.controlboxtoggle.show(callback);
                return this;
            },

            onControlBoxToggleHidden () {
                this.model.set('closed', false);
                this.el.classList.remove('hidden');
                /**
                 * Triggered once the controlbox has been opened
                 * @event _converse#controlBoxOpened
                 * @type {_converse.ControlBox}
                 */
                _converse.api.trigger('controlBoxOpened', this);
            },

            show () {
                _converse.controlboxtoggle.hide(
                    this.onControlBoxToggleHidden.bind(this)
                );
                return this;
            },

            showHelpMessages () {
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

            initialize () {
                this.listenTo(this.model, 'change', this.render)
                this.listenTo(_converse.connfeedback, 'change', this.render);
                this.render();
            },

            toHTML () {
                const connection_status = _converse.connfeedback.get('connection_status');
                let feedback_class, pretty_status;
                if (REPORTABLE_STATUSES.includes(connection_status)) {
                    pretty_status = PRETTY_CONNECTION_STATUS[connection_status];
                    feedback_class = CONNECTION_STATUS_CSS_CLASS[pretty_status];
                }
                return tpl_login_panel(
                    Object.assign(this.model.toJSON(), {
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
                        'show_trust_checkbox': _converse.trusted !== 'on' && _converse.trusted !== 'off'
                    })
                );
            },

            initPopovers () {
                Array.from(this.el.querySelectorAll('[data-title]')).forEach(el => {
                    new bootstrap.Popover(el, {
                        'trigger': _converse.view_mode === 'mobile' && 'click' || 'hover',
                        'dismissible': _converse.view_mode === 'mobile' && true || false,
                        'container': this.el.parentElement.parentElement.parentElement
                    })
                });
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
                    return this.connect(_converse.jid, null);
                }
                if (!this.validate()) { return; }

                const form_data = new FormData(ev.target);

                if (_converse.trusted === 'on' || _converse.trusted === 'off') {
                    _converse.config.save({
                        'trusted': _converse.trusted === 'on',
                        'storage': _converse.trusted === 'on' ? 'local' : 'session'
                    });
                } else {
                    _converse.config.save({
                        'trusted': form_data.get('trusted') && true || false,
                        'storage': form_data.get('trusted') ? 'local' : 'session'
                    });
                }

                let jid = form_data.get('jid');
                if (_converse.locked_domain) {
                    const last_part = '@' + _converse.locked_domain;
                    if (jid.endsWith(last_part)) {
                        jid = jid.substr(0, jid.length - last_part.length);
                    }
                    jid = Strophe.escapeNode(jid) + last_part;
                } else if (_converse.default_domain && !jid.includes('@')) {
                    jid = jid + '@' + _converse.default_domain;
                }
               this.connect(jid, form_data.get('password'));
            },

            connect (jid, password) {
                if (["converse/login", "converse/register"].includes(Backbone.history.getFragment())) {
                    _converse.router.navigate('', {'replace': true});
                }
                _converse.connection.reset();
                _converse.api.user.login(jid, password);
            }
        });


        _converse.ControlBoxPane = Backbone.NativeView.extend({
            tagName: 'div',
            className: 'controlbox-pane',

            initialize () {
                /**
                 * Triggered once the {@link _converse.ControlBoxPane} has been initialized
                 * @event _converse#controlBoxPaneInitialized
                 * @type { _converse.ControlBoxPane }
                 * @example _converse.api.listen.on('controlBoxPaneInitialized', view => { ... });
                 */
                _converse.api.trigger('controlBoxPaneInitialized', this);
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
                    .catch(e => _converse.log(e, Strophe.LogLevel.FATAL));
            },

            render () {
                // We let the render method of ControlBoxView decide whether
                // the ControlBox or the Toggle must be shown. This prevents
                // artifacts (i.e. on page load the toggle is shown only to then
                // seconds later be hidden in favor of the controlbox).
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
                    controlbox = addControlBox();
                }
                if (_converse.connection.connected) {
                    controlbox.save({'closed': false});
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


        /******************** Event Handlers ********************/

        _converse.api.listen.on('chatBoxViewsInitialized', () => {
            _converse.chatboxes.on('add', item => {
                if (item.get('type') === _converse.CONTROLBOX_TYPE) {
                    const views = _converse.chatboxviews;
                    const view = views.get(item.get('id'));
                    if (view) {
                        view.model = item;
                        view.initialize();
                    } else {
                        views.add(item.get('id'), new _converse.ControlBoxView({model: item}));
                    }
                }
            });
        });

        _converse.api.listen.on('clearSession', () => {
            const chatboxviews = get(_converse, 'chatboxviews', null);
            const view = chatboxviews && chatboxviews.get('controlbox');
            if (view) {
               u.safeSave(view.model, {'connected': false});
               if (get(view, 'controlbox_pane')) {
                  view.controlbox_pane.remove();
                  delete view.controlbox_pane;
               }
            }
        });


        Promise.all([
            _converse.api.waitUntil('connectionInitialized'),
            _converse.api.waitUntil('chatBoxViewsInitialized')
        ]).then(addControlBox).catch(e => _converse.log(e, Strophe.LogLevel.FATAL));

        _converse.api.listen.on('chatBoxesFetched', () => {
            const controlbox = _converse.chatboxes.get('controlbox') || addControlBox();
            controlbox.save({connected:true});
        });

        const disconnect =  function () {
            /* Upon disconnection, set connected to `false`, so that if
             * we reconnect, "onConnected" will be called,
             * to fetch the roster again and to send out a presence stanza.
             */
            const view = _converse.chatboxviews.get('controlbox');
            view.model.set({'connected': false});
            return view;
        };
        _converse.api.listen.on('disconnected', () => disconnect().renderLoginPanel());
        _converse.api.listen.on('will-reconnect', disconnect);

        /************************ API ************************/

        Object.assign(_converse.api, {
            /**
             * The "controlbox" namespace groups methods pertaining to the
             * controlbox view
             *
             * @namespace _converse.api.controlbox
             * @memberOf _converse.api
             */
            'controlbox': {
                /**
                 * Retrieves the controlbox view.
                 *
                 * @method _converse.api.controlbox.get
                 *
                 * @example
                 * const view = _converse.api.controlbox.get();
                 *
                 * @returns {Backbone.View} View representing the controlbox
                 */
                get () {
                    return _converse.chatboxviews.get('controlbox');
                }
            }
        });
    }
});
