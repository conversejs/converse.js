// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for in-band registration
 * as specified in XEP-0077.
 */
(function (root, factory) {
    define(["converse-core",
            "tpl!form_username",
            "tpl!register_panel",
            "tpl!register_tab",
            "tpl!registration_form",
            "tpl!registration_request",
            "converse-controlbox"
    ], factory);
}(this, function (
            converse,
            tpl_form_username,
            tpl_register_panel,
            tpl_register_tab,
            tpl_registration_form,
            tpl_registration_request) {

    "use strict";

    // Strophe methods for building stanzas
    var Strophe = converse.env.Strophe,
        utils = converse.env.utils,
        $iq = converse.env.$iq;
    // Other necessary globals
    var $ = converse.env.jQuery,
        _ = converse.env._;
    
    // Add Strophe Namespaces
    Strophe.addNamespace('REGISTER', 'jabber:iq:register');

    // Add Strophe Statuses
    var i = 0;
    _.each(_.keys(Strophe.Status), function (key) {
        i = Math.max(i, Strophe.Status[key]);
    });
    Strophe.Status.REGIFAIL        = i + 1;
    Strophe.Status.REGISTERED      = i + 2;
    Strophe.Status.CONFLICT        = i + 3;
    Strophe.Status.NOTACCEPTABLE   = i + 5;

    converse.plugins.add('converse-register', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ControlBoxView: {

                renderLoginPanel: function () {
                    /* Also render a registration panel, when rendering the
                     * login panel.
                     */
                    this.__super__.renderLoginPanel.apply(this, arguments);
                    var _converse = this.__super__._converse;
                    if (_converse.allow_registration) {
                        this.registerpanel = new _converse.RegisterPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': this
                        });
                        this.registerpanel.render().$el.addClass('hidden');
                        
                        if (_converse.registration_domain) {
                            this.registerpanel.renderRegistrationRequest('');
                            this.registerpanel.fetchRegistrationForm(_converse.registration_domain);   
                        }
                    }
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

            // Add new templates
            _converse.templates.form_username = tpl_form_username;
            _converse.templates.register_panel = tpl_register_panel;
            _converse.templates.register_tab = tpl_register_tab;
            _converse.templates.registration_form = tpl_registration_form;
            _converse.templates.registration_request = tpl_registration_request;

            this.updateSettings({
                allow_registration: true,
                domain_placeholder: __(" e.g. conversejs.org"),  // Placeholder text shown in the domain input on the registration form
                providers_link: 'https://xmpp.net/directory.php', // Link to XMPP providers shown on registration page
            });

            _converse.RegisterPanel = Backbone.View.extend({
                tagName: 'div',
                id: "register",
                className: 'controlbox-pane',
                events: {
                    'submit form#converse-register': 'onProviderChosen'
                },

                initialize: function (cfg) {
                    this.reset();
                    this.$parent = cfg.$parent;
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                    this.registerHooks();
                },

                render: function () {
                    this.$parent.append(this.$el.html(
                        tpl_register_panel({
                            'default_domain': _converse.registration_domain,
                            'label_domain': __("Your XMPP provider's domain name:"),
                            'label_register': __('Fetch registration form'),
                            'help_providers': __('Tip: A list of public XMPP providers is available'),
                            'help_providers_link': __('here'),
                            'href_providers': _converse.providers_link,
                            'domain_placeholder': _converse.domain_placeholder
                        })
                    ));
                    this.$tabs.append(tpl_register_tab({label_register: __('Register')}));
                    return this;
                },

                registerHooks: function () {
                    /* Hook into Strophe's _connect_cb, so that we can send an IQ
                     * requesting the registration fields.
                     */
                    var conn = _converse.connection;
                    var connect_cb = conn._connect_cb.bind(conn);
                    conn._connect_cb = function (req, callback, raw) {
                        if (!this._registering) {
                            connect_cb(req, callback, raw);
                        } else {
                            if (this.getRegistrationFields(req, callback, raw)) {
                                this._registering = false;
                            }
                        }
                    }.bind(this);
                },

                getRegistrationFields: function (req, _callback, raw) {
                    /*  Send an IQ stanza to the XMPP server asking for the
                     *  registration fields.
                     *  Parameters:
                     *    (Strophe.Request) req - The current request
                     *    (Function) callback
                     */
                    _converse.log("sendQueryStanza was called");
                    var conn = _converse.connection;
                    conn.connected = true;

                    var body = conn._proto._reqToData(req);
                    if (!body) { return; }
                    if (conn._proto._connect_cb(body) === Strophe.Status.CONNFAIL) {
                        return false;
                    }
                    var register = body.getElementsByTagName("register");
                    var mechanisms = body.getElementsByTagName("mechanism");
                    if (register.length === 0 && mechanisms.length === 0) {
                        conn._proto._no_auth_received(_callback);
                        return false;
                    }
                    if (register.length === 0) {
                        conn._changeConnectStatus(
                            Strophe.Status.REGIFAIL,
                            __('Sorry, the given provider does not support in band account registration. Please try with a different provider.')
                        );
                        return true;
                    }
                    // Send an IQ stanza to get all required data fields
                    conn._addSysHandler(this.onRegistrationFields.bind(this), null, "iq", null, null);
                    conn.send($iq({type: "get"}).c("query", {xmlns: Strophe.NS.REGISTER}).tree());
                    return true;
                },

                onRegistrationFields: function (stanza) {
                    /*  Handler for Registration Fields Request.
                     *
                     *  Parameters:
                     *    (XMLElement) elem - The query stanza.
                     */
                    if (stanza.getElementsByTagName("query").length !== 1) {
                        _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                        return false;
                    }
                    this.setFields(stanza);
                    this.renderRegistrationForm(stanza);
                    return false;
                },

                reset: function (settings) {
                    var defaults = {
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

                onProviderChosen: function (ev) {
                    /* Callback method that gets called when the user has chosen an
                     * XMPP provider.
                     *
                     * Parameters:
                     *      (Submit Event) ev - Form submission event.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $form = $(ev.target),
                        $domain_input = $form.find('input[name=domain]'),
                        domain = $domain_input.val();
                    if (!domain) {
                        $domain_input.addClass('error');
                        return;
                    }
                    $form.find('input[type=submit]').hide();
                    this.renderRegistrationRequest(__('Cancel'));
                    this.fetchRegistrationForm(domain);
                },

                fetchRegistrationForm: function(domain_name) {
                    /* This is called with a domain name based on which, it fetches a
                     * registration form from the requested domain.
                     *
                     * Parameters:
                     *      (Domain name) domain_name - XMPP server domain
                     */ 
                    this.reset({
                        domain: Strophe.getDomainFromJid(domain_name),
                        _registering: true
                    });
                    _converse.connection.connect(this.domain, "", this.onRegistering.bind(this));
                    return false; 
                },

                renderRegistrationRequest: function(cancel_label) {
                    var form_help = document.querySelector('.form-help');
                    $(form_help).after(tpl_registration_request({
                        cancel: cancel_label,
                        info_message: _converse.__('Requesting a registration form from the XMPP server')
                    }));
                    if (!_converse.registration_domain) {
                        var cancel_button = document.querySelector('button.button-cancel');
                        cancel_button.addEventListener('click', this.cancelRegistration.bind(this));
                    }
                },

                giveFeedback: function (message, klass) {
                    this.$('.reg-feedback').attr('class', 'reg-feedback').text(message);
                    if (klass) {
                        $('.reg-feedback').addClass(klass);
                    }
                },

                onRegistering: function (status, error) {
                    var that;
                    _converse.log('onRegistering');
                    if (_.includes([
                                Strophe.Status.DISCONNECTED,
                                Strophe.Status.CONNFAIL,
                                Strophe.Status.REGIFAIL,
                                Strophe.Status.NOTACCEPTABLE,
                                Strophe.Status.CONFLICT
                            ], status)) {

                        _converse.log('Problem during registration: Strophe.Status is: '+status);
                        this.cancelRegistration();
                        if (error) {
                            this.giveFeedback(error, 'error');
                        } else {
                            this.giveFeedback(__(
                                'Something went wrong while establishing a connection with "%1$s". Are you sure it exists?',
                                this.domain
                            ), 'error');
                        }
                    } else if (status === Strophe.Status.REGISTERED) {
                        _converse.log("Registered successfully.");
                        _converse.connection.reset();
                        that = this;
                        this.$('form').hide(function () {
                            $(this).replaceWith('<span class="spinner centered"/>');
                            if (that.fields.password && that.fields.username) {
                                // automatically log the user in
                                _converse.connection.connect(
                                    that.fields.username.toLowerCase()+'@'+that.domain.toLowerCase(),
                                    that.fields.password,
                                    _converse.onConnectStatusChanged
                                );
                                _converse.chatboxviews.get('controlbox')
                                    .switchTab({'target': that.$tabs.find('.current')});
                                _converse.giveFeedback(__('Now logging you in'));
                            } else {
                                _converse.chatboxviews.get('controlbox').renderLoginPanel();
                                _converse.giveFeedback(__('Registered successfully'));
                            }
                            that.reset();
                        });
                    }
                },

                renderRegistrationForm: function (stanza) {
                    /* Renders the registration form based on the XForm fields
                     * received from the XMPP server.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza received from the XMPP server.
                     */
                    var $form= this.$('form'),
                        $stanza = $(stanza),
                        $fields, $input;
                    $form.empty().append(tpl_registration_form({
                        'domain': this.domain,
                        'title': this.title,
                        'instructions': this.instructions
                    }));
                    if (this.form_type === 'xform') {
                        $fields = $stanza.find('field');
                        _.each($fields, function (field) {
                            $form.append(utils.xForm2webForm.bind(this, $(field), $stanza));
                        }.bind(this));
                    } else {
                        // Show fields
                        _.each(_.keys(this.fields), function (key) {
                            if (key === "username") {
                                $input = tpl_form_username({
                                    domain: ' @'+this.domain,
                                    name: key,
                                    type: "text",
                                    label: key,
                                    value: '',
                                    required: 1
                                });
                            } else {
                                $form.append('<label>'+key+'</label>');
                                $input = $('<input placeholder="'+key+'" name="'+key+'"></input>');
                                if (key === 'password' || key === 'email') {
                                    $input.attr('type', key);
                                }
                            }
                            $form.append($input);
                        }.bind(this));
                        // Show urls
                        _.each(this.urls, function (url) {
                            $form.append($('<a target="blank"></a>').attr('href', url).text(url));
                        }.bind(this));
                    }
                    if (this.fields) {
                        $form.append('<input type="submit" class="pure-button button-primary" value="'+__('Register')+'"/>');
                        $form.on('submit', this.submitRegistrationForm.bind(this));
                        $form.append('<input type="button" class="pure-button button-cancel" value="'+__('Cancel')+'"/>');
                        $form.find('input[type=button]').on('click', this.cancelRegistration.bind(this));
                    } else {
                        $form.append('<input type="button" class="submit" value="'+__('Return')+'"/>');
                        $form.find('input[type=button]').on('click', this.cancelRegistration.bind(this));
                    }
                    if (_converse.registration_domain) {
                        $form.find('input[type=button]').hide();
                    }
                },

                reportErrors: function (stanza) {
                    /* Report back to the user any error messages received from the
                     * XMPP server after attempted registration.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza received from the
                     *      XMPP server.
                     */
                    var $form= this.$('form'), flash;
                    var $errmsgs = $(stanza).find('error text');
                    var $flash = $form.find('.form-errors');
                    if (!$flash.length) {
                    flash = '<legend class="form-errors"></legend>';
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
                        $flash.append($('<p>').text($(txt).text()));
                    });
                    if (!$errmsgs.length) {
                        $flash.append($('<p>').text(
                            __('The provider rejected your registration attempt. '+
                            'Please check the values you entered for correctness.')));
                    }
                    $flash.show();
                },

                cancelRegistration: function (ev) {
                    /* Handler, when the user cancels the registration form.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    _converse.connection.reset();
                    this.render();
                    if (_converse.registration_domain) {
                        this.renderRegistrationRequest(__('Retry'));
                        document.querySelector('button.button-cancel').onclick = 
                            _.bind(this.fetchRegistrationForm, this, _converse.registration_domain); 
                    }
                },

                submitRegistrationForm : function (ev) {
                    /* Handler, when the user submits the registration form.
                     * Provides form error feedback or starts the registration
                     * process.
                     *
                     * Parameters:
                     *      (Event) ev - the submit event.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $empty_inputs = this.$('input.required:emptyVal');
                    if ($empty_inputs.length) {
                        $empty_inputs.addClass('error');
                        return;
                    }
                    var $inputs = $(ev.target).find(':input:not([type=button]):not([type=submit])'),
                        iq = $iq({type: "set"}).c("query", {xmlns:Strophe.NS.REGISTER});

                    if (this.form_type === 'xform') {
                        iq.c("x", {xmlns: Strophe.NS.XFORM, type: 'submit'});
                        $inputs.each(function () {
                            iq.cnode(utils.webForm2xForm(this)).up();
                        });
                    } else {
                        $inputs.each(function () {
                            var $input = $(this);
                            iq.c($input.attr('name'), {}, $input.val());
                        });
                    }
                    _converse.connection._addSysHandler(this._onRegisterIQ.bind(this), null, "iq", null, null);
                    _converse.connection.send(iq);
                    this.setFields(iq.tree());
                },

                setFields: function (stanza) {
                    /* Stores the values that will be sent to the XMPP server
                     * during attempted registration.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - the IQ stanza that will be sent to the XMPP server.
                     */
                    var $query = $(stanza).find('query'), $xform;
                    if ($query.length > 0) {
                        $xform = $query.find('x[xmlns="'+Strophe.NS.XFORM+'"]');
                        if ($xform.length > 0) {
                            this._setFieldsFromXForm($xform);
                        } else {
                            this._setFieldsFromLegacy($query);
                        }
                    }
                },

                _setFieldsFromLegacy: function ($query) {
                    $query.children().each(function (idx, field) {
                        var $field = $(field);
                        if (field.tagName.toLowerCase() === 'instructions') {
                            this.instructions = Strophe.getText(field);
                            return;
                        } else if (field.tagName.toLowerCase() === 'x') {
                            if ($field.attr('xmlns') === 'jabber:x:oob') {
                                $field.find('url').each(function (idx, url) {
                                    this.urls.push($(url).text());
                                }.bind(this));
                            }
                            return;
                        }
                        this.fields[field.tagName.toLowerCase()] = Strophe.getText(field);
                    }.bind(this));
                    this.form_type = 'legacy';
                },

                _setFieldsFromXForm: function ($xform) {
                    this.title = $xform.find('title').text();
                    this.instructions = $xform.find('instructions').text();
                    $xform.find('field').each(function (idx, field) {
                        var _var = field.getAttribute('var');
                        if (_var) {
                            this.fields[_var.toLowerCase()] = $(field).children('value').text();
                        } else {
                            // TODO: other option seems to be type="fixed"
                            _converse.log("WARNING: Found field we couldn't parse");
                        }
                    }.bind(this));
                    this.form_type = 'xform';
                },

                _onRegisterIQ: function (stanza) {
                    /* Callback method that gets called when a return IQ stanza
                     * is received from the XMPP server, after attempting to
                     * register a new user.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza.
                     */
                    var error = null,
                        query = stanza.getElementsByTagName("query");
                    if (query.length > 0) {
                        query = query[0];
                    }
                    if (stanza.getAttribute("type") === "error") {
                        _converse.log("Registration failed.");
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

                remove: function () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });
        }
    });
}));
