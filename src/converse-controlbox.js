/**
 * @module converse-controlbox
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "converse-chatview";
import "./components/brand-heading";
import bootstrap from "bootstrap.native";
import log from "@converse/headless/log";
import tpl_controlbox from "templates/controlbox.js";
import tpl_controlbox_toggle from "templates/controlbox_toggle.html";
import tpl_login_panel from "templates/login_panel.js";
import { Model } from '@converse/skeletor/src/model.js';
import { View } from "@converse/skeletor/src/view";
import { __ } from './i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { render } from 'lit-html';

const { Strophe, dayjs } = converse.env;
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
    dependencies: ["converse-modal", "converse-chatboxes", "converse-chat", "converse-rosterview", "converse-chatview"],


    enabled (_converse) {
        return !_converse.api.settings.get("singleton");
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
                if (attrs && attrs.id == 'controlbox') {
                    return new _converse.ControlBox(attrs, options);
                } else {
                    return this.__super__.model.apply(this, arguments);
                }
            }
        }
    },


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.extend({
            allow_logout: true,
            allow_user_trust_override: true,
            default_domain: undefined,
            locked_domain: undefined,
            show_controlbox_by_default: false,
            sticky_controlbox: false
        });

        api.promises.add('controlBoxInitialized');


        _converse.ControlBox = _converse.ChatBox.extend({

            defaults () {
                return {
                    'bookmarked': false,
                    'box_id': 'controlbox',
                    'chat_state': undefined,
                    'closed': !api.settings.get('show_controlbox_by_default'),
                    'num_unread': 0,
                    'time_opened': this.get('time_opened') || (new Date()).getTime(),
                    'type': _converse.CONTROLBOX_TYPE,
                    'url': ''
                }
            },

            initialize () {
                if (this.get('id') === 'controlbox') {
                    this.set({'time_opened': dayjs(0).valueOf()});
                } else {
                    _converse.ChatBox.prototype.initialize.apply(this, arguments);
                }
            },

            validate (attrs) {
                if (attrs.type === _converse.CONTROLBOX_TYPE) {
                    if (api.settings.get("view_mode") === 'embedded' && api.settings.get("singleton"))  {
                        return 'Controlbox not relevant in embedded view mode';
                    }
                    return;
                }
                return _converse.ChatBox.prototype.validate.call(this, attrs);
            },

            maybeShow (force) {
                if (!force && this.get('id') === 'controlbox') {
                   // Must return the chatbox
                   return this;
                }
                return _converse.ChatBox.prototype.maybeShow.call(this, force);
            },

            onReconnection: function onReconnection () {}
        });


        function addControlBox () {
            const m = new _converse.ControlBox({'id': 'controlbox'});
            return _converse.chatboxes.add(m);
        }


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
                api.trigger('controlBoxInitialized', this);
            },

            render () {
                if (this.model.get('connected')) {
                    if (this.model.get('closed') === undefined) {
                        this.model.set('closed', !api.settings.get('show_controlbox_by_default'));
                    }
                }

               const tpl_result = tpl_controlbox({
                    'sticky_controlbox': api.settings.get('sticky_controlbox'),
                     ...this.model.toJSON()
                });
                render(tpl_result, this.el);

                if (!this.model.get('closed')) {
                    this.show();
                } else {
                    this.hide();
                }

                const connection = _converse?.connection || {};
                if (!connection.connected || !connection.authenticated || connection.disconnecting) {
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

            async close (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                if (ev?.name === 'closeAllChatBoxes' &&
                        (_converse.disconnection_cause !== _converse.LOGOUT ||
                         api.settings.get('show_controlbox_by_default'))) {
                    return;
                }
                if (api.settings.get('sticky_controlbox')) {
                    return;
                }
                const connection = _converse?.connection || {};
                if (connection.connected && !connection.disconnecting) {
                    await new Promise((resolve, reject) => {
                        return this.model.save(
                            {'closed': true},
                            {'success': resolve, 'error': reject, 'wait': true}
                        );
                    });
                } else {
                    this.model.trigger('hide');
                }
                api.trigger('controlBoxClosed', this);
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
                if (api.settings.get('sticky_controlbox')) {
                    return;
                }
                u.addClass('hidden', this.el);
                api.trigger('chatBoxClosed', this);

                if (!api.connection.connected()) {
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
                api.trigger('controlBoxOpened', this);
            },

            show () {
                _converse.controlboxtoggle.hide(() => this.onControlBoxToggleHidden());
                return this;
            },

            showHelpMessages () {
                return;
            }
        });

        _converse.LoginPanelModel = Model.extend({
            defaults: {
                // Passed-by-reference. Fine in this case because there's
                // only one such model.
                'errors': [],
            }
        });

        _converse.LoginPanel = View.extend({
            tagName: 'div',
            id: "converse-login-panel",
            className: 'controlbox-pane fade-in row no-gutters',
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
                        '_converse': _converse,
                        'ANONYMOUS': _converse.ANONYMOUS,
                        'EXTERNAL': _converse.EXTERNAL,
                        'LOGIN': _converse.LOGIN,
                        'PREBIND': _converse.PREBIND,
                        'auto_login': api.settings.get('auto_login'),
                        'authentication': api.settings.get("authentication"),
                        'connection_status': connection_status,
                        'conn_feedback_class': feedback_class,
                        'conn_feedback_subject': pretty_status,
                        'conn_feedback_message': _converse.connfeedback.get('message'),
                        'placeholder_username': (api.settings.get('locked_domain') || api.settings.get('default_domain')) &&
                                                __('Username') || __('user@domain'),
                        'show_trust_checkbox': api.settings.get('allow_user_trust_override')
                    })
                );
            },

            initPopovers () {
                Array.from(this.el.querySelectorAll('[data-title]')).forEach(el => {
                    new bootstrap.Popover(el, {
                        'trigger': api.settings.get("view_mode") === 'mobile' && 'click' || 'hover',
                        'dismissible': api.settings.get("view_mode") === 'mobile' && true || false,
                        'container': this.el.parentElement.parentElement.parentElement
                    })
                });
            },

            validate () {
                const form = this.el.querySelector('form');
                const jid_element = form.querySelector('input[name=jid]');
                if (jid_element.value &&
                        !api.settings.get('locked_domain') &&
                        !api.settings.get('default_domain') &&
                        !u.isValidJID(jid_element.value)) {
                    jid_element.setCustomValidity(__('Please enter a valid XMPP address'));
                    return false;
                }
                jid_element.setCustomValidity('');
                return true;
            },

            /**
             * Authenticate the user based on a form submission event.
             * @param { Event } ev
             */
            authenticate (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                if (api.settings.get("authentication") === _converse.ANONYMOUS) {
                    return this.connect(_converse.jid, null);
                }
                if (!this.validate()) { return; }

                const form_data = new FormData(ev.target);
                _converse.config.save({'trusted': form_data.get('trusted') && true || false});

                let jid = form_data.get('jid');
                if (api.settings.get('locked_domain')) {
                    const last_part = '@' + api.settings.get('locked_domain');
                    if (jid.endsWith(last_part)) {
                        jid = jid.substr(0, jid.length - last_part.length);
                    }
                    jid = Strophe.escapeNode(jid) + last_part;
                } else if (api.settings.get('default_domain') && !jid.includes('@')) {
                    jid = jid + '@' + api.settings.get('default_domain');
                }
               this.connect(jid, form_data.get('password'));
            },

            connect (jid, password) {
                if (["converse/login", "converse/register"].includes(_converse.router.history.getFragment())) {
                    _converse.router.navigate('', {'replace': true});
                }
                _converse.connection && _converse.connection.reset();
                api.user.login(jid, password);
            }
        });


        _converse.ControlBoxPane = View.extend({
            tagName: 'div',
            className: 'controlbox-pane',

            initialize () {
                /**
                 * Triggered once the {@link _converse.ControlBoxPane} has been initialized
                 * @event _converse#controlBoxPaneInitialized
                 * @type { _converse.ControlBoxPane }
                 * @example _converse.api.listen.on('controlBoxPaneInitialized', view => { ... });
                 */
                api.trigger('controlBoxPaneInitialized', this);
            }
        });


        _converse.ControlBoxToggle = View.extend({
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
                api.waitUntil('initialized')
                    .then(this.render.bind(this))
                    .catch(e => log.fatal(e));
            },

            render () {
                // We let the render method of ControlBoxView decide whether
                // the ControlBox or the Toggle must be shown. This prevents
                // artifacts (i.e. on page load the toggle is shown only to then
                // seconds later be hidden in favor of the controlbox).
                this.el.innerHTML = tpl_controlbox_toggle({
                    'label_toggle': api.connection.connected() ? __('Chat Contacts') : __('Toggle chat')
                })
                return this;
            },

            hide (callback) {
                if (u.isVisible(this.el)) {
                    u.hideElement(this.el);
                    callback();
                }
            },

            show (callback) {
                if (!u.isVisible(this.el)) {
                    u.fadeIn(this.el, callback);
                }
            },

            showControlBox () {
                let controlbox = _converse.chatboxes.get('controlbox');
                if (!controlbox) {
                    controlbox = addControlBox();
                }
                if (api.connection.connected()) {
                    controlbox.save({'closed': false});
                } else {
                    controlbox.trigger('show');
                }
            },

            onClick (e) {
                e.preventDefault();
                if (u.isVisible(_converse.root.querySelector("#controlbox"))) {
                    const controlbox = _converse.chatboxes.get('controlbox');
                    if (api.connection.connected) {
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
        api.listen.on('cleanup', () => (delete _converse.controlboxtoggle));

        api.listen.on('chatBoxViewsInitialized', () => {
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

        api.listen.on('clearSession', () => {
            const chatboxviews = _converse?.chatboxviews;
            const view = chatboxviews && chatboxviews.get('controlbox');
            if (view) {
               u.safeSave(view.model, {'connected': false});
               if (view?.controlbox_pane) {
                  view.controlbox_pane.remove();
                  delete view.controlbox_pane;
               }
            }
        });


        api.waitUntil('chatBoxViewsInitialized')
           .then(addControlBox)
           .catch(e => log.fatal(e));

        api.listen.on('chatBoxesFetched', () => {
            const controlbox = _converse.chatboxes.get('controlbox') || addControlBox();
            controlbox.save({'connected': true});
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
        api.listen.on('disconnected', () => disconnect().renderLoginPanel());
        api.listen.on('will-reconnect', disconnect);

        /************************ API ************************/

        Object.assign(api, {
            /**
             * The "controlbox" namespace groups methods pertaining to the
             * controlbox view
             *
             * @namespace _converse.api.controlbox
             * @memberOf _converse.api
             */
            controlbox: {
                /**
                 * Opens the controlbox
                 * @method _converse.api.controlbox.open
                 * @returns { Promise<_converse.ControlBox> }
                 */
                async open () {
                    await api.waitUntil('chatBoxesFetched');
                    const model = await api.chatboxes.get('controlbox') ||
                      api.chatboxes.create('controlbox', {}, _converse.Controlbox);
                    model.trigger('show');
                    return model;
                },

                /**
                 * Returns the controlbox view.
                 * @method _converse.api.controlbox.get
                 * @returns { View } View representing the controlbox
                 * @example const view = _converse.api.controlbox.get();
                 */
                get () {
                    return _converse.chatboxviews.get('controlbox');
                }
            }
        });
    }
});
