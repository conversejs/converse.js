import log from "@converse/headless/log";
import pick from "lodash-es/pick";
import tpl_form_input from "templates/form_input.js";
import tpl_form_url from "templates/form_url.js";
import tpl_form_username from "templates/form_username.js";
import tpl_register_panel from "./templates/register_panel.js";
import tpl_spinner from "templates/spinner.js";
import utils from "@converse/headless/utils/form";
import { ElementView } from "@converse/skeletor/src/element";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { render } from 'lit';

// Strophe methods for building stanzas
const { Strophe, sizzle, $iq } = converse.env;
const u = converse.env.utils;


const CHOOSE_PROVIDER = 0;
const FETCHING_FORM = 1;
const REGISTRATION_FORM = 2;


/**
 * @class
 * @namespace _converse.RegisterPanel
 * @memberOf _converse
 */
class RegisterPanel extends ElementView {
    id = "converse-register-panel"
    className = 'controlbox-pane fade-in'
    events = {
        'submit form#converse-register': 'onFormSubmission',
        'click .button-cancel': 'renderProviderChoiceForm',
    }

    initialize () {
        this.reset();
        const controlbox = _converse.chatboxes.get('controlbox');
        this.model = controlbox;
        this.listenTo(_converse, 'connectionInitialized', this.registerHooks);
        this.listenTo(this.model, 'change:registration_status', this.render);

        const domain = api.settings.get('registration_domain');
        if (domain) {
            this.fetchRegistrationForm(domain);
        } else {
            this.model.set('registration_status', CHOOSE_PROVIDER);
        }
    }

    render () {
        render(tpl_register_panel({
            'domain': this.domain,
            'fields': this.fields,
            'form_fields': this.form_fields,
            'instructions': this.instructions,
            'model': this.model,
            'title': this.title,
        }), this);
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
            } else {
                if (this.getRegistrationFields(req, callback)) {
                    this._registering = false;
                }
            }
        };
    }

    connectedCallback () {
        super.connectedCallback();
        this.render();
    }

    /**
     * Send an IQ stanza to the XMPP server asking for the registration fields.
     * @private
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
            this.showValidationError(
                __("Sorry, we're unable to connect to your chosen provider.")
            );
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
            this.showValidationError(
                __("Sorry, the given provider does not support in "+
                   "band account registration. Please try with a "+
                   "different provider."))
            return true;
        }
        // Send an IQ stanza to get all required data fields
        conn._addSysHandler(this.onRegistrationFields.bind(this), null, "iq", null, null);
        const stanza = $iq({type: "get"}).c("query", {xmlns: Strophe.NS.REGISTER}).tree();
        stanza.setAttribute("id", conn.getUniqueId("sendIQ"));
        conn.send(stanza);
        conn.connected = false;
        return true;
    }

    /**
     * Handler for {@link _converse.RegisterPanel#getRegistrationFields}
     * @private
     * @method _converse.RegisterPanel#onRegistrationFields
     * @param { XMLElement } stanza - The query stanza.
     */
    onRegistrationFields (stanza) {
        if (stanza.getAttribute("type") === "error") {
            _converse.connection._changeConnectStatus(
                Strophe.Status.REGIFAIL,
                __('Something went wrong while establishing a connection with "%1$s". '+
                   'Are you sure it exists?', this.domain)
            );
            return false;
        }
        if (stanza.getElementsByTagName("query").length !== 1) {
            _converse.connection._changeConnectStatus(
                Strophe.Status.REGIFAIL,
                "unknown"
            );
            return false;
        }
        this.setFields(stanza);
        if (this.model.get('registration_status') === FETCHING_FORM) {
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
        if (settings) {
            Object.assign(this, pick(settings, Object.keys(defaults)));
        }
    }

    /**
     * Event handler when the #converse-register form is submitted.
     * Depending on the available input fields, we delegate to other methods.
     * @private
     * @param { Event } ev
     */
    onFormSubmission (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        if (ev.target.querySelector('input[name=domain]') === null) {
            this.submitRegistrationForm(ev.target);
        } else {
            this.onProviderChosen(ev.target);
        }

    }

    /**
     * Callback method that gets called when the user has chosen an XMPP provider
     * @private
     * @method _converse.RegisterPanel#onProviderChosen
     * @param { HTMLElement } form - The form that was submitted
     */
    onProviderChosen (form) {
        const domain_input = form.querySelector('input[name=domain]'),
            domain = domain_input?.value;
        if (!domain) {
            // TODO: add validation message
            domain_input.classList.add('error');
            return;
        }
        form.querySelector('input[type=submit]').classList.add('hidden');
        this.fetchRegistrationForm(domain.trim());
    }

    /**
     * Fetch a registration form from the requested domain
     * @private
     * @method _converse.RegisterPanel#fetchRegistrationForm
     * @param { String } domain_name - XMPP server domain
     */
    async fetchRegistrationForm (domain_name) {
        this.model.set('registration_status', FETCHING_FORM);
        this.reset({
            'domain': Strophe.getDomainFromJid(domain_name),
            '_registering': true
        });
        await _converse.initConnection(this.domain);
        // When testing, the test tears down before the async function
        // above finishes. So we use optional chaining here
        _converse.connection?.connect(this.domain, "", status => this.onConnectStatusChanged(status));
        return false;
    }

    giveFeedback (message, klass) {
        let feedback = this.querySelector('.reg-feedback');
        if (feedback !== null) {
            feedback.parentNode.removeChild(feedback);
        }
        const form = this.querySelector('form');
        form.insertAdjacentHTML('afterbegin', '<span class="reg-feedback"></span>');
        feedback = form.querySelector('.reg-feedback');
        feedback.textContent = message;
        if (klass) {
            feedback.classList.add(klass);
        }
    }

    showSpinner () {
        const form = this.querySelector('form');
        render(tpl_spinner(), form);
        return this;
    }

    /**
     * Callback function called by Strophe whenever the connection status changes.
     * Passed to Strophe specifically during a registration attempt.
     * @private
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
            this.showSpinner();

            if (["converse/login", "converse/register"].includes(_converse.router.history.getFragment())) {
                _converse.router.navigate('', {'replace': true});
            }

            if (this.fields.password && this.fields.username) {
                // automatically log the user in
                _converse.connection.connect(
                    this.fields.username.toLowerCase()+'@'+this.domain.toLowerCase(),
                    this.fields.password,
                    _converse.onConnectStatusChanged
                );
                this.giveFeedback(__('Now logging you in'), 'info');
            } else {
                _converse.giveFeedback(__('Registered successfully'));
            }
            this.reset();
        }
    }

    getLegacyFormFields () {
        const input_fields = Object.keys(this.fields).map(key => {
            if (key === "username") {
                return tpl_form_username({
                    'domain': ` @${this.domain}`,
                    'name': key,
                    'type': "text",
                    'label': key,
                    'value': '',
                    'required': true
                });
            } else {
                return tpl_form_input({
                    'label': key,
                    'name': key,
                    'placeholder': key,
                    'required': true,
                    'type': (key === 'password' || key === 'email') ? key : "text",
                    'value': ''
                })
            }
        });
        const urls = this.urls.map(u => tpl_form_url({'label': '', 'value': u}));
        return [...input_fields, ...urls];
    }

    getFormFields (stanza) {
        if (this.form_type === 'xform') {
            return Array.from(stanza.querySelectorAll('field')).map(field =>
                utils.xForm2TemplateResult(field, stanza, {'domain': this.domain})
            );
        } else {
            return this.getLegacyFormFields();
        }
    }

    /**
     * Renders the registration form based on the XForm fields
     * received from the XMPP server.
     * @private
     * @method _converse.RegisterPanel#renderRegistrationForm
     * @param { XMLElement } stanza - The IQ stanza received from the XMPP server.
     */
    renderRegistrationForm (stanza) {
        this.form_fields = this.getFormFields(stanza);
        this.model.set('registration_status', REGISTRATION_FORM);
    }

    showValidationError (message) {
        const form = this.querySelector('form');
        let flash = form.querySelector('.form-errors');
        if (flash === null) {
            flash = '<div class="form-errors hidden"></div>';
            const instructions = form.querySelector('p.instructions');
            if (instructions === null) {
                form.insertAdjacentHTML('afterbegin', flash);
            } else {
                instructions.insertAdjacentHTML('afterend', flash);
            }
            flash = form.querySelector('.form-errors');
        } else {
            flash.innerHTML = '';
        }
        flash.insertAdjacentHTML(
            'beforeend',
            '<p class="form-help error">'+message+'</p>'
        );
        flash.classList.remove('hidden');
    }

    /**
     * Report back to the user any error messages received from the
     * XMPP server after attempted registration.
     * @private
     * @method _converse.RegisterPanel#reportErrors
     * @param { XMLElement } stanza - The IQ stanza received from the XMPP server
     */
    reportErrors (stanza) {
        const errors = stanza.querySelectorAll('error');
        errors.forEach(e => this.showValidationError(e.textContent));
        if (!errors.length) {
            const message = __('The provider rejected your registration attempt. '+
                'Please check the values you entered for correctness.');
            this.showValidationError(message);
        }
    }

    renderProviderChoiceForm (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        _converse.connection._proto._abortAllRequests();
        _converse.connection.reset();
        this.render();
    }

    abortRegistration () {
        _converse.connection._proto._abortAllRequests();
        _converse.connection.reset();
        if ([FETCHING_FORM, REGISTRATION_FORM].includes(this.model.get('registration_status'))) {
            if (api.settings.get('registration_domain')) {
                this.fetchRegistrationForm(api.settings.get('registration_domain'));
            }
        } else {
            this.render();
        }
    }

    /**
     * Handler, when the user submits the registration form.
     * Provides form error feedback or starts the registration process.
     * @private
     * @method _converse.RegisterPanel#submitRegistrationForm
     * @param { HTMLElement } form - The HTML form that was submitted
     */
    submitRegistrationForm (form) {
        const has_empty_inputs = Array.from(this.querySelectorAll('input.required'))
            .reduce((result, input) => {
                if (input.value === '') {
                    input.classList.add('error');
                    return result + 1;
                }
                return result;
            }, 0);
        if (has_empty_inputs) { return; }

        const inputs = sizzle(':input:not([type=button]):not([type=submit])', form);
        const iq = $iq({'type': 'set', 'id': u.getUniqueId()})
                    .c("query", {xmlns:Strophe.NS.REGISTER});

        if (this.form_type === 'xform') {
            iq.c("x", {xmlns: Strophe.NS.XFORM, type: 'submit'});

            const xml_nodes = inputs.map(i => utils.webForm2xForm(i)).filter(n => n);
            xml_nodes.forEach(n => iq.cnode(n).up());
        } else {
            inputs.forEach(input => iq.c(input.getAttribute('name'), {}, input.value));
        }
        _converse.connection._addSysHandler(this._onRegisterIQ.bind(this), null, "iq", null, null);
        _converse.connection.send(iq);
        this.setFields(iq.tree());
    }

    /* Stores the values that will be sent to the XMPP server during attempted registration.
     * @private
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
        this.title = xform.querySelector('title')?.textContent;
        this.instructions = xform.querySelector('instructions')?.textContent;
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
     * @private
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
