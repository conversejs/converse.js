export default RegistrationForm;
declare class RegistrationForm extends CustomElement {
    /**
     * @typedef {import('strophe.js').Request} Request
     */
    static get properties(): {
        status: {
            type: StringConstructor;
        };
        domain: {
            type: StringConstructor;
        };
        service_url: {
            type: StringConstructor;
        };
        alert_message: {
            type: StringConstructor;
        };
        alert_type: {
            type: StringConstructor;
        };
    };
    urls: any[];
    fields: {};
    domain: any;
    alert_type: string;
    setErrorMessage: (m: string) => void;
    setFeedbackMessage: (m: string) => void;
    initialize(): void;
    status: number;
    render(): import("lit").TemplateResult<1>;
    /**
     * @param {string} message
     * @param {'info'|'danger'} type
     */
    setMessage(message: string, type: "info" | "danger"): void;
    alert_message: any;
    /**
     * Hook into Strophe's _connect_cb, so that we can send an IQ
     * requesting the registration fields.
     */
    registerHooks(): void;
    _registering: boolean;
    /**
     * Send an IQ stanza to the XMPP server asking for the registration fields.
     * @method _converse.RegistrationForm#getRegistrationFields
     * @param {Request} req - The current request
     * @param {Function} callback - The callback function
     */
    getRegistrationFields(req: import("strophe.js").Request, callback: Function): boolean;
    /**
     * Handler for {@link _converse.RegistrationForm#getRegistrationFields}
     * @method _converse.RegistrationForm#onRegistrationFields
     * @param {Element} stanza - The query stanza.
     */
    onRegistrationFields(stanza: Element): boolean;
    reset(settings: any): void;
    /**
     * Event handler when the #converse-register form is submitted.
     * Depending on the available input fields, we delegate to other methods.
     * @param {Event} ev
     */
    onFormSubmission(ev: Event): void;
    /**
     * Callback method that gets called when the user has chosen an XMPP provider
     * @param {HTMLFormElement} form - The form that was submitted
     */
    onProviderChosen(form: HTMLFormElement): void;
    /**
     * Fetch a registration form from the requested domain
     * @param {string} domain_name - XMPP server domain
     * @param {string|null} [service_url]
     */
    fetchRegistrationForm(domain_name: string, service_url?: string | null): boolean;
    /**
     * Callback function called by Strophe whenever the connection status changes.
     * Passed to Strophe specifically during a registration attempt.
     * @param {number} status_code - The Strophe.Status status code
     * @param {string} message
     */
    onConnectStatusChanged(status_code: number, message: string): void;
    getLegacyFormFields(): import("lit").TemplateResult<1>[];
    /**
     * @param {Element} stanza
     */
    getFormFields(stanza: Element): any[];
    /**
     * Renders the registration form based on the XForm fields
     * received from the XMPP server.
     * @param {Element} stanza - The IQ stanza received from the XMPP server.
     */
    renderRegistrationForm(stanza: Element): void;
    form_fields: any[];
    /**
     * Report back to the user any error messages received from the
     * XMPP server after attempted registration.
     * @param {Element} stanza - The IQ stanza received from the XMPP server
     */
    reportErrors(stanza: Element): Promise<void>;
    /**
     * @param {Event} ev
     */
    renderProviderChoiceForm(ev: Event): void;
    /**
     * @param {string} message
     */
    abortRegistration(message: string): void;
    /**
     * Handler, when the user submits the registration form.
     * Provides form error feedback or starts the registration process.
     * @method _converse.RegistrationForm#submitRegistrationForm
     * @param {HTMLElement} form - The HTML form that was submitted
     */
    submitRegistrationForm(form: HTMLElement): void;
    /**
     * Stores the values that will be sent to the XMPP server during attempted registration.
     * @method _converse.RegistrationForm#setFields
     * @param {Element} stanza - the IQ stanza that will be sent to the XMPP server.
     */
    setFields(stanza: Element): void;
    /**
     * @param {Element} query
     */
    setFieldsFromLegacy(query: Element): void;
    instructions: any;
    form_type: string;
    /**
     * @param {Element} xform
     */
    setFieldsFromXForm(xform: Element): void;
    #private;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=form.d.ts.map