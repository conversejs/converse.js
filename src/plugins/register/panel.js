import log from "@converse/headless/log";
import tplFormInput from "templates/form_input.js";
import tplFormUrl from "templates/form_url.js";
import tplFormUsername from "templates/form_username.js";
import tplRegisterPanel from "./templates/register_panel.js";
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core.js";
import { initConnection } from '@converse/headless/utils/init.js';
import { setActiveForm } from './utils.js';
import { webForm2xForm } from "@converse/headless/utils/form";

import './styles/register.scss';

// Strophe methods for building stanzas
const { Strophe, sizzle, $iq } = converse.env;
const u = converse.env.utils;


const CHOOSE_PROVIDER = 0;
const FETCHING_FORM = 1;
const REGISTRATION_FORM = 2;
const REGISTRATION_FORM_ERROR = 3;


/**
 * @class
 * @namespace _converse.RegisterPanel
 * @memberOf _converse
 */
class RegisterPanel extends CustomElement {

    static get properties () {
        return {
            status : { type: String },
            alert_message: { type: String },
            alert_type: { type: String },
        }
    }

    constructor () {
        super();
        this.alert_type = 'info';
        this.setErrorMessage = (m) => this.setMessage(m, 'danger');
        this.setFeedbackMessage = (m) => this.setMessage(m, 'info');
    }

    initialize () {
        this.reset();
        this.listenTo(_converse, 'connectionInitialized', () => this.registerHooks());

        const domain = api.settings.get('registration_domain');
        if (domain) {
            this.fetchRegistrationForm(domain);
        } else {
            this.status = CHOOSE_PROVIDER;
        }
    }

    render () {
        return tplRegisterPanel(this);
    }

    setMessage(message, type) {
        this.alert_type = type;
        this.alert_message = message;
    }

    /**
     * Hook into Strophe's _connect_cb, so that we can send an IQ
     * requesting the registration fields.
     */
    registerHooks () {
        const conn = _converse.connection;
        const connect_cb = conn._connect_cb.bind(conn);
        conn._connect_cb = (req, callback, raw) => {
            if (!this._registering) {
                connect_cb(req, callback, raw);
            } else if (this.getRegistrationFields(req, callback)) {
                this._registering = false;
            }
        };
    }

    /**
     * Send an IQ stanza to the XMPP server asking for the registration fields.
     * @method _converse.RegisterPanel#getRegistrationFields
     * @param { Strophe.Request } req - The current request
     * @param { Function } callback - The callback function
     */
    getRegistrationFields (req, _callback) {
        const conn = _converse.connection;
        conn.connected = true;

        const body = conn._proto._reqToData(req);
        if (!body) { return; }
        if (conn._proto._connect_cb(body) === Strophe.Status.CONNFAIL) {
            this.status = CHOOSE_PROVIDER;
            this.setErrorMessage(__("Sorry, we're unable to connect to your chosen provider."));
            return false;
        }
        const register = body.getElementsByTagName("register");
        const mechanisms = body.getElementsByTagName("mechanism");
        if (register.length === 0 && mechanisms.length === 0) {
            conn._proto._no_auth_received(_callback);
            return false;
        }
        if (register.length === 0) {
            conn._changeConnectStatus(Strophe.Status.REGIFAIL);
            this.alert_type = 'danger';
            this.setErrorMessage(
                __("Sorry, the given provider does not support in "+
                   "band account registration. Please try with a "+
                   "different provider."));
            return true;
        }
        // Send an IQ stanza to get all required data fields
        conn._addSysHandler((s) => this.onRegistrationFields(s), null, "iq", null, null);
        const stanza = $iq({type: "get"}).c("query", {xmlns: Strophe.NS.REGISTER}).tree();
        stanza.setAttribute("id", conn.getUniqueId("sendIQ"));
        conn.send(stanza);
        conn.connected = false;
        return true;
    }

    /**
     * Handler for {@link _converse.RegisterPanel#getRegistrationFields}
     * @method _converse.RegisterPanel#onRegistrationFields
     * @param { XMLElement } stanza - The query stanza.
     */
    onRegistrationFields (stanza) {
        if (stanza.getAttribute("type") === "error") {
            this.reportErrors(stanza);
            if (api.settings.get('registration_domain')) {
                this.status = REGISTRATION_FORM_ERROR;
            } else {
                this.status = CHOOSE_PROVIDER;
            }
            return false;
        }
        this.setFields(stanza);
        if (this.status === FETCHING_FORM) {
            this.renderRegistrationForm(stanza);
        }
        return false;
    }

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
        Object.assign(this, defaults);
        if (settings) Object.assign(this, settings);
    }

    /**
     * Event handler when the #converse-register form is submitted.
     * Depending on the available input fields, we delegate to other methods.
     * @param { Event } ev
     */
    onFormSubmission (ev) {
        ev?.preventDefault?.();
        if (ev.target.querySelector('input[name=domain]') === null) {
            this.submitRegistrationForm(ev.target);
        } else {
            this.onProviderChosen(ev.target);
        }

    }

    /**
     * Callback method that gets called when the user has chosen an XMPP provider
     * @method _converse.RegisterPanel#onProviderChosen
     * @param { HTMLElement } form - The form that was submitted
     */
    onProviderChosen (form) {
        const domain = form.querySelector('input[name=domain]')?.value;
        if (domain) this.fetchRegistrationForm(domain.trim());
    }

    /**
     * Fetch a registration form from the requested domain
     * @method _converse.RegisterPanel#fetchRegistrationForm
     * @param { String } domain_name - XMPP server domain
     */
    fetchRegistrationForm (domain_name) {
        this.status = FETCHING_FORM;
        this.reset({
            'domain': Strophe.getDomainFromJid(domain_name),
            '_registering': true
        });
        initConnection(this.domain);
        // When testing, the test tears down before the async function
        // above finishes. So we use optional chaining here
        _converse.connection?.connect(this.domain, "", (s) => this.onConnectStatusChanged(s));
        return false;
    }

    /**
     * Callback function called by Strophe whenever the connection status changes.
     * Passed to Strophe specifically during a registration attempt.
     * @method _converse.RegisterPanel#onConnectStatusChanged
     * @param { integer } status_code - The Strophe.Status status code
     */
    onConnectStatusChanged(status_code) {
        log.debug('converse-register: onConnectStatusChanged');
        if ([Strophe.Status.DISCONNECTED,
             Strophe.Status.CONNFAIL,
             Strophe.Status.REGIFAIL,
             Strophe.Status.NOTACCEPTABLE,
             Strophe.Status.CONFLICT
            ].includes(status_code)) {

            log.error(
                `Problem during registration: Strophe.Status is ${_converse.CONNECTION_STATUS[status_code]}`
            );
            this.abortRegistration();
        } else if (status_code === Strophe.Status.REGISTERED) {
            log.debug("Registered successfully.");
            _converse.connection.reset();

            if (["converse/login", "converse/register"].includes(_converse.router.history.getFragment())) {
                _converse.router.navigate('', {'replace': true});
            }
            setActiveForm('login');

            if (this.fields.password && this.fields.username) {
                // automatically log the user in
                _converse.connection.connect(
                    this.fields.username.toLowerCase()+'@'+this.domain.toLowerCase(),
                    this.fields.password,
                    _converse.onConnectStatusChanged
                );
                this.setFeedbackMessage(__('Now logging you in'));
            } else {
                this.setFeedbackMessage(__('Registered successfully'));
            }
            this.reset();
        }
    }

    getLegacyFormFields () {
        const input_fields = Object.keys(this.fields).map(key => {
            if (key === "username") {
                return tplFormUsername({
                    'domain': ` @${this.domain}`,
                    'name': key,
                    'type': "text",
                    'label': key,
                    'value': '',
                    'required': true
                });
            } else {
                return tplFormInput({
                    'label': key,
                    'name': key,
                    'placeholder': key,
                    'required': true,
                    'type': (key === 'password' || key === 'email') ? key : "text",
                    'value': ''
                })
            }
        });
        const urls = this.urls.map(u => tplFormUrl({'label': '', 'value': u}));
        return [...input_fields, ...urls];
    }

    getFormFields (stanza) {
        if (this.form_type === 'xform') {
            return Array.from(stanza.querySelectorAll('field')).map(field =>
                u.xForm2TemplateResult(field, stanza, {'domain': this.domain})
            );
        } else {
            return this.getLegacyFormFields();
        }
    }

    /**
     * Renders the registration form based on the XForm fields
     * received from the XMPP server.
     * @method _converse.RegisterPanel#renderRegistrationForm
     * @param { XMLElement } stanza - The IQ stanza received from the XMPP server.
     */
    renderRegistrationForm (stanza) {
        this.form_fields = this.getFormFields(stanza);
        this.status = REGISTRATION_FORM;
    }

    /**
     * Report back to the user any error messages received from the
     * XMPP server after attempted registration.
     * @method _converse.RegisterPanel#reportErrors
     * @param { XMLElement } stanza - The IQ stanza received from the XMPP server
     */
    reportErrors (stanza) {
        const errors = Array.from(stanza.querySelectorAll('error'));
        if (errors.length) {
            this.setErrorMessage(errors.reduce((result, e) => `${result}\n${e.textContent}`, ''));
        } else {
            this.setErrorMessage(__('The provider rejected your registration attempt. '+
                'Please check the values you entered for correctness.'));
        }
    }

    renderProviderChoiceForm (ev) {
        ev?.preventDefault?.();
        _converse.connection._proto._abortAllRequests();
        _converse.connection.reset();
        this.status = CHOOSE_PROVIDER;
    }

    abortRegistration () {
        _converse.connection._proto._abortAllRequests();
        _converse.connection.reset();
        if ([FETCHING_FORM, REGISTRATION_FORM].includes(this.status)) {
            if (api.settings.get('registration_domain')) {
                this.fetchRegistrationForm(api.settings.get('registration_domain'));
            }
        } else {
            this.requestUpdate();
        }
    }

    /**
     * Handler, when the user submits the registration form.
     * Provides form error feedback or starts the registration process.
     * @method _converse.RegisterPanel#submitRegistrationForm
     * @param { HTMLElement } form - The HTML form that was submitted
     */
    submitRegistrationForm (form) {
        const inputs = sizzle(':input:not([type=button]):not([type=submit])', form);
        const iq = $iq({'type': 'set', 'id': u.getUniqueId()})
                    .c("query", {xmlns:Strophe.NS.REGISTER});

        if (this.form_type === 'xform') {
            iq.c("x", {xmlns: Strophe.NS.XFORM, type: 'submit'});

            const xml_nodes = inputs.map(i => webForm2xForm(i)).filter(n => n);
            xml_nodes.forEach(n => iq.cnode(n).up());
        } else {
            inputs.forEach(input => iq.c(input.getAttribute('name'), {}, input.value));
        }
        _converse.connection._addSysHandler((iq) => this._onRegisterIQ(iq), null, "iq", null, null);
        _converse.connection.send(iq);
        this.setFields(iq.tree());
    }

    /**
     * Stores the values that will be sent to the XMPP server during attempted registration.
     * @method _converse.RegisterPanel#setFields
     * @param { XMLElement } stanza - the IQ stanza that will be sent to the XMPP server.
     */
    setFields (stanza) {
        const query = stanza.querySelector('query');
        const xform = sizzle(`x[xmlns="${Strophe.NS.XFORM}"]`, query);
        if (xform.length > 0) {
            this._setFieldsFromXForm(xform.pop());
        } else {
            this._setFieldsFromLegacy(query);
        }
    }

    _setFieldsFromLegacy (query) {
        [].forEach.call(query.children, field => {
            if (field.tagName.toLowerCase() === 'instructions') {
                this.instructions = Strophe.getText(field);
                return;
            } else if (field.tagName.toLowerCase() === 'x') {
                if (field.getAttribute('xmlns') === 'jabber:x:oob') {
                    this.urls.concat(sizzle('url', field).map(u => u.textContent));
                }
                return;
            }
            this.fields[field.tagName.toLowerCase()] = Strophe.getText(field);
        });
        this.form_type = 'legacy';
    }

    _setFieldsFromXForm (xform) {
        this.title = xform.querySelector('title')?.textContent ?? '';
        this.instructions = xform.querySelector('instructions')?.textContent ?? '';
        xform.querySelectorAll('field').forEach(field => {
            const _var = field.getAttribute('var');
            if (_var) {
                this.fields[_var.toLowerCase()] = field.querySelector('value')?.textContent ?? '';
            } else {
                // TODO: other option seems to be type="fixed"
                log.warn("Found field we couldn't parse");
            }
        });
        this.form_type = 'xform';
    }

    /**
     * Callback method that gets called when a return IQ stanza
     * is received from the XMPP server, after attempting to
     * register a new user.
     * @method _converse.RegisterPanel#reportErrors
     * @param { XMLElement } stanza - The IQ stanza.
     */
    _onRegisterIQ (stanza) {
        if (stanza.getAttribute("type") === "error") {
            log.error("Registration failed.");
            this.reportErrors(stanza);

            let error = stanza.getElementsByTagName("error");
            if (error.length !== 1) {
                _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                return false;
            }
            error = error[0].firstElementChild.tagName.toLowerCase();
            if (error === 'conflict') {
                _converse.connection._changeConnectStatus(Strophe.Status.CONFLICT, error);
            } else if (error === 'not-acceptable') {
                _converse.connection._changeConnectStatus(Strophe.Status.NOTACCEPTABLE, error);
            } else {
                _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, error);
            }
        } else {
            _converse.connection._changeConnectStatus(Strophe.Status.REGISTERED, null);
        }
        return false;
    }
}

api.elements.define('converse-register-panel', RegisterPanel);
