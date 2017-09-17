// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a Converse.js plugin which add support for in-band registration
 * as specified in XEP-0077.
 */
(function (root, factory) {
    define(["jquery.noconflict",
            "form-utils",
            "converse-core",
            "tpl!form_username",
            "tpl!register_link",
            "tpl!register_panel",
            "tpl!registration_form",
            "tpl!registration_request",
            "tpl!form_input",
            "tpl!spinner",
            "converse-controlbox"
    ], factory);
}(this, function (
            $,
            utils,
            converse,
            tpl_form_username,
            tpl_register_link,
            tpl_register_panel,
            tpl_registration_form,
            tpl_registration_request,
            tpl_form_input,
            tpl_spinner
        ) {

    "use strict";

    // Strophe methods for building stanzas
    const { Strophe, Backbone, $iq, _ } = converse.env;

    // Add Strophe Namespaces
    Strophe.addNamespace('REGISTER', 'jabber:iq:register');

    // Add Strophe Statuses
    let i = 0;
    _.each(_.keys(Strophe.Status), function (key) {
        i = Math.max(i, Strophe.Status[key]);
    });
    Strophe.Status.REGIFAIL        = i + 1;
    Strophe.Status.REGISTERED      = i + 2;
    Strophe.Status.CONFLICT        = i + 3;
    Strophe.Status.NOTACCEPTABLE   = i + 5;

    converse.plugins.add('converse-register', {

        'overrides': {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
        
            LoginPanel: {

                initialize: function (cfg) {
                    const { _converse } = this.__super__;
                    this.__super__.initialize.apply(this, arguments);
                    if (_converse.allow_registration) {
                        const div = document.createElement('div');
                        div.innerHTML = tpl_register_link({'__': _converse.__})
                        this.el.appendChild(div);
                    }
                }
            },

            ControlBoxView: {

                initialize () {
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:active-form', this.showLoginOrRegisterForm.bind(this))
                },

                showLoginOrRegisterForm (ev) {
                    const { _converse } = this.__super__;
                    if (this.model.get('active-form') == "register") {
                        this.loginpanel.el.classList.add('hidden');
                        this.registerpanel.el.classList.remove('hidden');
                    } else {
                        this.loginpanel.el.classList.remove('hidden');
                        this.registerpanel.el.classList.add('hidden');
                    }
                },


                renderRegistrationPanel () {
                    const { _converse } = this.__super__;
                    if (_converse.allow_registration) {
                        this.registerpanel = new _converse.RegisterPanel({
                            'model': this.model
                        });
                        this.registerpanel.render();
                        this.registerpanel.el.classList.add('hidden');
                        this.el.querySelector('#converse-login-panel').insertAdjacentElement(
                            'afterend',
                            this.registerpanel.el
                        );
                        this.showLoginOrRegisterForm();
                    }
                    return this;
                },

                renderLoginPanel () {
                    /* Also render a registration panel, when rendering the
                     * login panel.
                     */
                    this.__super__.renderLoginPanel.apply(this, arguments);
                    this.renderRegistrationPanel();
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
                allow_registration: true,
                domain_placeholder: __(" e.g. conversejs.org"),  // Placeholder text shown in the domain input on the registration form
                providers_link: 'https://xmpp.net/directory.php', // Link to XMPP providers shown on registration page
            });

            _converse.RegistrationRouter = Backbone.Router.extend({

                initialize () {
                    this.route('converse-login', _.partial(this.setActiveForm, 'login'));
                    this.route('converse-register', _.partial(this.setActiveForm, 'register'));
                },

                setActiveForm (value) {
                    _converse.api.waitUntil('controlboxInitialized').then(() => {
                        const controlbox = _converse.chatboxes.get('controlbox')
                        if (controlbox.get('connected')) {
                            controlbox.save({'active-form': value});
                        } else {
                            controlbox.set({'active-form': value});
                        }
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                }
            });
            const router = new _converse.RegistrationRouter();


            _converse.RegisterPanel = Backbone.View.extend({
                tagName: 'div',
                id: "converse-register-panel",
                className: 'controlbox-pane fade-in',
                events: {
                    'submit form#converse-register': 'onProviderChosen',
                    'click .button-cancel': 'cancelRegistration'
                },

                initialize (cfg) {
                    this.reset();
                    this.registerHooks();
                },

                render () {
                    this.model.set('registration_form_rendered', false);
                    this.el.innerHTML = tpl_register_panel({
                        '__': __,
                        'default_domain': _converse.registration_domain,
                        'label_register': __('Fetch registration form'),
                        'help_providers': __('Tip: A list of public XMPP providers is available'),
                        'help_providers_link': __('here'),
                        'href_providers': _converse.providers_link,
                        'domain_placeholder': _converse.domain_placeholder
                    });
                    if (_converse.registration_domain) {
                        this.fetchRegistrationForm(
                            _converse.registration_domain
                        );
                    }
                    return this;
                },

                registerHooks () {
                    /* Hook into Strophe's _connect_cb, so that we can send an IQ
                     * requesting the registration fields.
                     */
                    const conn = _converse.connection;
                    const connect_cb = conn._connect_cb.bind(conn);
                    conn._connect_cb = (req, callback, raw) => {
                        if (!this._registering) {
                            connect_cb(req, callback, raw);
                        } else {
                            if (this.getRegistrationFields(req, callback, raw)) {
                                this._registering = false;
                            }
                        }
                    };
                },

                getRegistrationFields (req, _callback, raw) {
                    /*  Send an IQ stanza to the XMPP server asking for the
                     *  registration fields.
                     *  Parameters:
                     *    (Strophe.Request) req - The current request
                     *    (Function) callback
                     */
                    const conn = _converse.connection;
                    conn.connected = true;

                    const body = conn._proto._reqToData(req);
                    if (!body) { return; }
                    if (conn._proto._connect_cb(body) === Strophe.Status.CONNFAIL) {
                        return false;
                    }
                    const register = body.getElementsByTagName("register");
                    const mechanisms = body.getElementsByTagName("mechanism");
                    if (register.length === 0 && mechanisms.length === 0) {
                        conn._proto._no_auth_received(_callback);
                        return false;
                    }
                    if (register.length === 0) {
                        conn._changeConnectStatus(
                            Strophe.Status.REGIFAIL,
                            __("Sorry, the given provider does not support in "+
                               "band account registration. Please try with a "+
                               "different provider.")
                        );
                        return true;
                    }
                    // Send an IQ stanza to get all required data fields
                    conn._addSysHandler(this.onRegistrationFields.bind(this), null, "iq", null, null);
                    const stanza = $iq({type: "get"}).c("query", {xmlns: Strophe.NS.REGISTER}).tree();
                    stanza.setAttribute("id", conn.getUniqueId("sendIQ"));
                    conn.send(stanza);
                    conn.connected = false;
                    return true;
                },

                onRegistrationFields (stanza) {
                    /*  Handler for Registration Fields Request.
                     *
                     *  Parameters:
                     *    (XMLElement) elem - The query stanza.
                     */
                    if (stanza.getAttribute("type") === "error") {
                        _converse.connection._changeConnectStatus(
                            Strophe.Status.REGIFAIL,
                            __('Something went wrong while establishing a connection with "%1$s". Are you sure it exists?', this.domain)
                        );
                        return false;
                    }
                    if (stanza.getElementsByTagName("query").length !== 1) {
                        _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                        return false;
                    }
                    this.setFields(stanza);
                    if (!this.model.get('registration_form_rendered')) {
                        this.renderRegistrationForm(stanza);
                    }
                    return false;
                },

                reset (settings) {
                    const defaults = {
                        fields: {},
                        urls: [],
                        title: "",
                        instructions: "",
                        registered: false,
                        _registering: false,
                        domain: null,
                        form_type: null
                    };
                    _.extend(this, defaults);
                    if (settings) {
                        _.extend(this, _.pick(settings, _.keys(defaults)));
                    }
                },

                onProviderChosen (ev) {
                    /* Callback method that gets called when the user has chosen an
                     * XMPP provider.
                     *
                     * Parameters:
                     *      (Submit Event) ev - Form submission event.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const $form = $(ev.target),
                        $domain_input = $form.find('input[name=domain]'),
                        domain = $domain_input.val();
                    if (!domain) {
                        $domain_input.addClass('error');
                        return;
                    }
                    $form.find('input[type=submit]').hide();
                    this.fetchRegistrationForm(domain);
                },

                fetchRegistrationForm (domain_name) {
                    /* This is called with a domain name based on which, it fetches a
                     * registration form from the requested domain.
                     *
                     * Parameters:
                     *      (String) domain_name - XMPP server domain
                     */
                    if (!this.model.get('registration_form_rendered')) {
                        this.renderRegistrationRequest();
                    }
                    this.reset({
                        domain: Strophe.getDomainFromJid(domain_name),
                        _registering: true
                    });
                    _converse.connection.connect(this.domain, "", this.onRegistering.bind(this));
                    return false;
                },

                renderRegistrationRequest () {
                    /* Clear the form and inform the user that the registration
                     * form is being fetched.
                     */
                    this.clearRegistrationForm().insertAdjacentHTML(
                        'beforeend',
                        tpl_registration_request({
                            '__': _converse.__,
                            'cancel': _converse.registration_domain,
                        })
                    );
                },

                giveFeedback (message, klass) {
                    let feedback = this.el.querySelector('.reg-feedback');
                    if (_.isNull(feedback)) {
                        const form = this.el.querySelector('form');
                        form.insertAdjacentHTML(
                            'afterbegin',
                            '<span class="reg-feedback"></span>'
                        );
                        feedback = form.querySelector('.reg-feedback');
                    }
                    feedback.setAttribute('class', 'reg-feedback');
                    feedback.textContent = message;
                    if (klass) {
                        $('.reg-feedback').addClass(klass);
                    }
                },

                clearRegistrationForm () {
                    const form = this.el.querySelector('form');
                    form.innerHTML = '';
                    return form;
                },

                showRegistrationForm () {
                    const form = this.el.querySelector('form');
                    form.classList.remove('hidden');
                    return form;
                },

                onRegistering (status, error) {
                    /* Callback function called by Strophe */
                    _converse.log('onRegistering');
                    if (_.includes([
                                Strophe.Status.DISCONNECTED,
                                Strophe.Status.CONNFAIL,
                                Strophe.Status.REGIFAIL,
                                Strophe.Status.NOTACCEPTABLE,
                                Strophe.Status.CONFLICT
                            ], status)) {

                        _converse.log(
                            `Problem during registration: Strophe.Status is: ${status}`,
                            Strophe.LogLevel.ERROR
                        );
                        this.cancelRegistration(error);
                        if (error) {
                            this.giveFeedback(__(
                                'Something went wrong while establishing a connection with "%1$s". The returned error message is "%2$s"',
                                this.domain, error
                            ), 'error');
                        } else {
                            this.giveFeedback(__(
                                'Something went wrong while establishing a connection with "%1$s". Are you sure it exists?',
                                this.domain
                            ), 'error');
                        }
                    } else if (status === Strophe.Status.REGISTERED) {
                        router.navigate(); // Strip the URL fragment
                        _converse.log("Registered successfully.");
                        this.model.set('registration_form_rendered', false);
                        _converse.connection.reset();
                        const form = this.el.querySelector('form');
                        form.innerHTML = tpl_spinner();

                        if (this.fields.password && this.fields.username) {
                            // automatically log the user in
                            _converse.connection.connect(
                                this.fields.username.toLowerCase()+'@'+this.domain.toLowerCase(),
                                this.fields.password,
                                _converse.onConnectStatusChanged
                            );
                            this.giveFeedback(__('Now logging you in'));
                        } else {
                            _converse.chatboxviews.get('controlbox').renderLoginPanel();
                            _converse.giveFeedback(__('Registered successfully'));
                        }
                        this.reset();
                    }
                },

                renderLegacyRegistrationForm (form) {
                    _.each(_.keys(this.fields), (key) => {
                        if (key === "username") {
                            form.insertAdjacentHTML(
                                'beforeend',
                                tpl_form_username({
                                    'domain': ` @${this.domain}`,
                                    'name': key,
                                    'type': "text",
                                    'label': key,
                                    'value': '',
                                    'required': true
                                })
                            );
                        } else {
                            form.insertAdjacentHTML(
                                'beforeend',
                                tpl_form_input({
                                    'label': key, 
                                    'name': key,
                                    'placeholder': key,
                                    'required': true,
                                    'type': (key === 'password' || key === 'email') ? key : "text",
                                    'value': ''
                                })
                            );
                        }
                    });
                    // Show urls
                    _.each(this.urls, (url) => {
                        $(form).append($('<a target="blank"></a>').attr('href', url).text(url));
                    });
                },

                renderRegistrationForm (stanza) {
                    /* Renders the registration form based on the XForm fields
                     * received from the XMPP server.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza received from the XMPP server.
                     */
                    const form = this.el.querySelector('form');
                    form.innerHTML = tpl_registration_form({
                        '__': _converse.__,
                        'domain': this.domain,
                        'title': this.title,
                        'instructions': this.instructions
                    });
                    if (this.form_type === 'xform') {
                        _.each(stanza.querySelectorAll('field'), (field) => {
                            form.insertAdjacentHTML(
                                'beforeend',
                                utils.xForm2webForm(field, stanza, this.domain)
                            );
                        });
                    } else {
                        this.renderLegacyRegistrationForm(form);
                    }
                    if (this.fields) {
                        form.insertAdjacentHTML(
                            'beforeend',
                            `<input type="submit" class="pure-button button-primary" value="${__('Register')}"/>`
                        );
                        if (!_converse.registration_domain) {
                            form.insertAdjacentHTML(
                                'beforeend',
                                `<input type="button" class="pure-button button-cancel" value="${__('Choose a different provider')}"/>`
                            );
                        }
                        form.addEventListener('submit', this.submitRegistrationForm.bind(this));
                    } else {
                        form.insertAdjacentHTML(
                            'beforeend',
                            `<input type="button" class="submit" value="${__('Return')}"/>`
                        );
                        form.querySelector('input[type=button]').addEventListener(
                            'click', this.cancelRegistration.bind(this));
                    }
                    this.model.set('registration_form_rendered', true);
                    this.showRegistrationForm();
                },

                reportErrors (stanza) {
                    /* Report back to the user any error messages received from the
                     * XMPP server after attempted registration.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza received from the
                     *      XMPP server.
                     */
                    const $form= this.$('form'),
                          $errmsgs = $(stanza).find('error text');

                    let $flash = $form.find('.form-errors');
                    if (!$flash.length) {
                    const flash = '<legend class="form-errors"></legend>';
                        if ($form.find('p.instructions').length) {
                            $form.find('p.instructions').append(flash);
                        } else {
                            $form.prepend(flash);
                        }
                        $flash = $form.find('.form-errors');
                    } else {
                        $flash.empty();
                    }
                    $errmsgs.each(function (idx, txt) {
                        $flash.append($('<p class="form-help error">').text($(txt).text()));
                    });
                    if (!$errmsgs.length) {
                        $flash.append($('<p class="form-help error">').text(
                            __('The provider rejected your registration attempt. '+
                            'Please check the values you entered for correctness.')));
                    }
                    $flash.show();
                },

                cancelRegistration (ev) {
                    /* Handler, when the user cancels the registration form.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    _converse.connection._proto._abortAllRequests();
                    _converse.connection.reset();
                    if (_converse.registration_domain && this.model.get('registration_form_rendered')) {
                        this.fetchRegistrationForm(
                            _converse.registration_domain
                        );
                    } else {
                        this.render();
                    }
                },

                submitRegistrationForm (ev) {
                    /* Handler, when the user submits the registration form.
                     * Provides form error feedback or starts the registration
                     * process.
                     *
                     * Parameters:
                     *      (Event) ev - the submit event.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const has_empty_inputs = _.reduce(
                        this.el.querySelectorAll('input.required'),
                        function (result, input) {
                            if (input.value === '') {
                                input.classList.add('error');
                                return result + 1;
                            }
                            return result;
                        }, 0);
                    if (has_empty_inputs) { return; }
                    const $inputs = $(ev.target).find(':input:not([type=button]):not([type=submit])'),
                        iq = $iq({type: "set"}).c("query", {xmlns:Strophe.NS.REGISTER});

                    if (this.form_type === 'xform') {
                        iq.c("x", {xmlns: Strophe.NS.XFORM, type: 'submit'});
                        $inputs.each(function () {
                            iq.cnode(utils.webForm2xForm(this)).up();
                        });
                    } else {
                        $inputs.each(function () {
                            const $input = $(this);
                            iq.c($input.attr('name'), {}, $input.val());
                        });
                    }
                    _converse.connection._addSysHandler(this._onRegisterIQ.bind(this), null, "iq", null, null);
                    _converse.connection.send(iq);
                    this.setFields(iq.tree());
                },

                setFields (stanza) {
                    /* Stores the values that will be sent to the XMPP server
                     * during attempted registration.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - the IQ stanza that will be sent to the XMPP server.
                     */
                    const $query = $(stanza).find('query');
                    if ($query.length > 0) {
                        const $xform = $query.find(`x[xmlns="${Strophe.NS.XFORM}"]`);
                        if ($xform.length > 0) {
                            this._setFieldsFromXForm($xform);
                        } else {
                            this._setFieldsFromLegacy($query);
                        }
                    }
                },

                _setFieldsFromLegacy ($query) {
                    $query.children().each((idx, field) => {
                        const $field = $(field);
                        if (field.tagName.toLowerCase() === 'instructions') {
                            this.instructions = Strophe.getText(field);
                            return;
                        } else if (field.tagName.toLowerCase() === 'x') {
                            if ($field.attr('xmlns') === 'jabber:x:oob') {
                                $field.find('url').each((idx, url) => {
                                    this.urls.push($(url).text());
                                });
                            }
                            return;
                        }
                        this.fields[field.tagName.toLowerCase()] = Strophe.getText(field);
                    });
                    this.form_type = 'legacy';
                },

                _setFieldsFromXForm ($xform) {
                    this.title = $xform.find('title').text();
                    this.instructions = $xform.find('instructions').text();
                    $xform.find('field').each((idx, field) => {
                        const _var = field.getAttribute('var');
                        if (_var) {
                            this.fields[_var.toLowerCase()] = $(field).children('value').text();
                        } else {
                            // TODO: other option seems to be type="fixed"
                            _converse.log("Found field we couldn't parse", Strophe.LogLevel.WARN);
                        }
                    });
                    this.form_type = 'xform';
                },

                _onRegisterIQ (stanza) {
                    /* Callback method that gets called when a return IQ stanza
                     * is received from the XMPP server, after attempting to
                     * register a new user.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza.
                     */
                    let error = null,
                        query = stanza.getElementsByTagName("query");
                    if (query.length > 0) {
                        query = query[0];
                    }
                    if (stanza.getAttribute("type") === "error") {
                        _converse.log("Registration failed.", Strophe.LogLevel.ERROR);
                        error = stanza.getElementsByTagName("error");
                        if (error.length !== 1) {
                            _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                            return false;
                        }
                        error = error[0].firstChild.tagName.toLowerCase();
                        if (error === 'conflict') {
                            _converse.connection._changeConnectStatus(Strophe.Status.CONFLICT, error);
                        } else if (error === 'not-acceptable') {
                            _converse.connection._changeConnectStatus(Strophe.Status.NOTACCEPTABLE, error);
                        } else {
                            _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, error);
                        }
                        this.reportErrors(stanza);
                    } else {
                        _converse.connection._changeConnectStatus(Strophe.Status.REGISTERED, null);
                    }
                    return false;
                },

                remove () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });
        }
    });
}));
