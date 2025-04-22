import { _converse, api, converse, log, constants, u, parsers, errors } from "@converse/headless";
import tplFormInput from "templates/form_input.js";
import tplFormUrl from "templates/form_url.js";
import tplFormUsername from "templates/form_username.js";
import tplChooseProvider from "./templates/choose_provider.js";
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { setActiveForm } from './utils.js';

import './styles/register.scss';

// Strophe methods for building stanzas
const { Strophe, sizzle, $iq } = converse.env;
const { CONNECTION_STATUS } = constants;

const CHOOSE_PROVIDER = 0;
const FETCHING_FORM = 1;
const REGISTRATION_FORM = 2;
const REGISTRATION_FORM_ERROR = 3;


class RegistrationForm extends CustomElement {
    /**
     * @typedef {import('strophe.js').Request} Request
     */

    static get properties () {
        return {
            status : { type: String },
            domain: { type: String },
            service_url: { type: String },
            alert_message: { type: String },
            alert_type: { type: String },
        }
    }

    constructor () {
        super();
        this.urls = [];
        this.fields = {};
        this.domain = null;
        this.alert_type = 'info';
        this.setErrorMessage = /** @param {string} m */(m) => this.setMessage(m, 'danger');
        this.setFeedbackMessage = /** @param {string} m */(m) => this.setMessage(m, 'info');
    }

    initialize () {
        this.reset();
        this.listenTo(_converse, 'connectionInitialized', () => this.registerHooks());

        const settings = api.settings.get();
        this.listenTo(settings, 'change:show_connection_url_input', () => this.requestUpdate());

        const domain = api.settings.get('registration_domain');
        if (domain) {
            this.fetchRegistrationForm(domain);
        } else {
            this.status = CHOOSE_PROVIDER;
        }
    }

    render () {
        return tplChooseProvider(this);
    }

    /**
     * @param {string} message
     * @param {'info'|'danger'} type
     */
    setMessage(message, type) {
        this.alert_type = type;
        this.alert_message = message;
    }

    /**
     * Hook into Strophe's _connect_cb, so that we can send an IQ
     * requesting the registration fields.
     */
    registerHooks () {
        const conn = api.connection.get();
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
     * @method _converse.RegistrationForm#getRegistrationFields
     * @param {Request} req - The current request
     * @param {Function} callback - The callback function
     */
    getRegistrationFields (req, callback) {
        const conn = api.connection.get();
        conn.connected = true;

        const body = /** @type {Element} */ (
            '_reqToData' in conn._proto ? conn._proto._reqToData(/** @type {Request} */ (req)) : req
        );
        if (!body) { return; }

        if (conn._proto._connect_cb(body) === Strophe.Status.CONNFAIL) {
            this.status = CHOOSE_PROVIDER;
            this.setErrorMessage(__("Sorry, we're unable to connect to your chosen provider."));
            return false;
        }
        const register = body.getElementsByTagName("register");
        const mechanisms = body.getElementsByTagName("mechanism");
        if (register.length === 0 && mechanisms.length === 0) {
            conn._proto._no_auth_received(callback);
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
     * Handler for {@link _converse.RegistrationForm#getRegistrationFields}
     * @method _converse.RegistrationForm#onRegistrationFields
     * @param {Element} stanza - The query stanza.
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
     * @param {Event} ev
     */
    onFormSubmission (ev) {
        ev?.preventDefault?.();
        const form = /** @type {HTMLFormElement} */(ev.target);

        const domain_input = /** @type {HTMLInputElement} */(form.querySelector('input[name=domain]'));
        if (domain_input === null) {
            this.submitRegistrationForm(form);
        } else {
            this.onProviderChosen(form);
        }
    }

    /**
     * Callback method that gets called when the user has chosen an XMPP provider
     * @param {HTMLFormElement} form - The form that was submitted
     */
    onProviderChosen (form) {
        const domain = /** @type {HTMLInputElement} */(form.querySelector('input[name=domain]'))?.value;
        if (domain) {
            const form_data = new FormData(form);
            let service_url = null;
            if (api.settings.get('show_connection_url_input')) {
                service_url = /** @type {string} */(form_data.get('connection-url'));
                if (service_url.startsWith('wss:')) {
                    api.settings.set("websocket_url", service_url);
                } else if (service_url.startsWith('https:')) {
                    api.settings.set('bosh_service_url', service_url);
                } else {
                    this.alert_message = __('Invalid connection URL, only HTTPS and WSS accepted');
                    this.alert_type = 'danger';
                    this.status = CHOOSE_PROVIDER;
                    this.requestUpdate();
                    return;
                }
            }
            this.fetchRegistrationForm(domain.trim(), service_url?.trim());
        } else {
            this.status = CHOOSE_PROVIDER;
        }
    }

    /**
     * Fetch a registration form from the requested domain
     * @param {string} domain_name - XMPP server domain
     * @param {string|null} [service_url]
     */
    fetchRegistrationForm (domain_name, service_url) {
        this.status = FETCHING_FORM;
        this.reset({
            _registering: true,
            domain: Strophe.getDomainFromJid(domain_name),
            service_url,
        });

        api.connection.init();

        // When testing, the test tears down before the async function
        // above finishes. So we use optional chaining here
        api.connection.get()?.connect(
            this.domain,
            '',
            /**
             * @param {number} s
             * @param {string} m
             */
            (s, m) => this.onConnectStatusChanged(s, m)
        );
        return false;
    }

    /**
     * Callback function called by Strophe whenever the connection status changes.
     * Passed to Strophe specifically during a registration attempt.
     * @param {number} status_code - The Strophe.Status status code
     * @param {string} message
     */
    onConnectStatusChanged(status_code, message) {
        log.debug('converse-register: onConnectStatusChanged');
        if ([Strophe.Status.DISCONNECTED,
            Strophe.Status.CONNFAIL,
            Strophe.Status.REGIFAIL,
             Strophe.Status.NOTACCEPTABLE,
             Strophe.Status.CONFLICT
            ].includes(status_code)) {

            log.warn(
                `Problem during registration: Strophe.Status is ${CONNECTION_STATUS[status_code]}`
            );
            this.abortRegistration(message);
        } else if (status_code === Strophe.Status.REGISTERED) {
            log.debug("Registered successfully.");
            api.connection.get().reset();

            if (["converse/login", "converse/register"].includes(window.location.hash)) {
                history.pushState(null, '', window.location.pathname);
            }
            setActiveForm('login');

            if (this.fields.password && this.fields.username) {
                const connection = api.connection.get();
                // automatically log the user in
                connection.connect(
                    this.fields.username.toLowerCase()+'@'+this.domain.toLowerCase(),
                    this.fields.password,
                    connection.onConnectStatusChanged
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

    /**
     * @param {Element} stanza
     */
    getFormFields (stanza) {
        if (this.form_type === 'xform') {
            const { fields } = parsers.parseXForm(stanza);
            return fields?.map((f) => u.xFormField2TemplateResult(f, { domain: this.domain})) ?? [];
        } else {
            return this.getLegacyFormFields();
        }
    }

    /**
     * Renders the registration form based on the XForm fields
     * received from the XMPP server.
     * @param {Element} stanza - The IQ stanza received from the XMPP server.
     */
    renderRegistrationForm (stanza) {
        this.form_fields = this.getFormFields(stanza);
        this.status = REGISTRATION_FORM;
    }

    /**
     * Report back to the user any error messages received from the
     * XMPP server after attempted registration.
     * @param {Element} stanza - The IQ stanza received from the XMPP server
     */
    async reportErrors (stanza) {
        const error = await parsers.parseErrorStanza(stanza);
        if (error instanceof errors.ConflictError) {
            this.setErrorMessage(
                `${__('Registration failed.')} ${__('Please try a different username.')}`)
            return;
        }

        const error_els = Array.from(stanza.querySelectorAll('error'));
        if (error_els.length) {
            this.setErrorMessage(
                `${__('Registration failed.')}${error_els.reduce((result, e) => `${result}\n${e.textContent}`, '')}`
            );
        } else {
            this.setErrorMessage(__('The provider rejected your registration attempt. '+
                'Please check the values you entered for correctness.'));
        }
    }

    /**
     * @param {Event} ev
     */
    renderProviderChoiceForm (ev) {
        ev?.preventDefault?.();
        const connection = api.connection.get();
        connection._proto._abortAllRequests();
        connection.reset();
        this.status = CHOOSE_PROVIDER;
    }

    /**
     * @param {string} message
     */
    abortRegistration (message) {
        const connection = api.connection.get();
        connection._proto._abortAllRequests();
        connection.reset();
        if ([FETCHING_FORM, REGISTRATION_FORM].includes(this.status)) {
            if (api.settings.get('registration_domain')) {
                this.fetchRegistrationForm(api.settings.get('registration_domain'));
                return;
            }
        }
        this.alert_message = message;
        this.alert_type = 'danger';
        this.status = CHOOSE_PROVIDER;
        this.requestUpdate();
    }

    /**
     * Handler, when the user submits the registration form.
     * Provides form error feedback or starts the registration process.
     * @method _converse.RegistrationForm#submitRegistrationForm
     * @param {HTMLElement} form - The HTML form that was submitted
     */
    submitRegistrationForm (form) {
        const /** @type {HTMLInputElement[]} */inputs = sizzle(':input:not([type=button]):not([type=submit])', form);
        const iq = $iq({'type': 'set', 'id': u.getUniqueId()})
                    .c("query", {xmlns:Strophe.NS.REGISTER});

        if (this.form_type === 'xform') {
            iq.c("x", {xmlns: Strophe.NS.XFORM, type: 'submit'});

            const xml_nodes = inputs.map(i => u.webForm2xForm(i)).filter(n => n);
            xml_nodes.forEach(n => iq.cnode(n).up());
        } else {
            inputs.forEach(input => iq.c(input.getAttribute('name'), {}, input.value));
        }

        const connection = api.connection.get();
        connection._addSysHandler(/** @param {Element} iq */(iq) => this.#onRegisterIQ(iq), null, "iq", null, null);
        connection.send(iq);
        this.setFields(iq.tree());
    }

    /**
     * Stores the values that will be sent to the XMPP server during attempted registration.
     * @method _converse.RegistrationForm#setFields
     * @param {Element} stanza - the IQ stanza that will be sent to the XMPP server.
     */
    setFields (stanza) {
        const query = stanza.querySelector('query');
        const xform = sizzle(`x[xmlns="${Strophe.NS.XFORM}"]`, query);
        if (xform.length > 0) {
            this.setFieldsFromXForm(xform.pop());
        } else {
            this.setFieldsFromLegacy(query);
        }
    }

    /**
     * @param {Element} query
     */
    setFieldsFromLegacy (query) {
        [].forEach.call(query.children, /** @param {Element} field */(field) => {
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

    /**
     * @param {Element} xform
     */
    setFieldsFromXForm (xform) {
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
     * @param {Element} stanza - The IQ stanza.
     */
    #onRegisterIQ (stanza) {
        const connection = api.connection.get();
        if (stanza.getAttribute("type") === "error") {
            log.info("Registration failed.");
            this.reportErrors(stanza);

            const error_els = stanza.getElementsByTagName("error");
            if (error_els.length !== 1) {
                connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                return false;
            }

            const error = error_els[0].firstElementChild.tagName.toLowerCase();
            if (error === 'conflict') {
                connection._changeConnectStatus(Strophe.Status.CONFLICT, error);
            } else if (error === 'not-acceptable') {
                connection._changeConnectStatus(Strophe.Status.NOTACCEPTABLE, error);
            } else {
                connection._changeConnectStatus(Strophe.Status.REGIFAIL, error);
            }
        } else {
            connection._changeConnectStatus(Strophe.Status.REGISTERED, null);
        }
        return false;
    }
}

api.elements.define('converse-registration-form', RegistrationForm);

export default RegistrationForm;
