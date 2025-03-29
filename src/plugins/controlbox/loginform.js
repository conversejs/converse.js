import Popover from 'bootstrap/js/src/popover.js';
import { _converse, api, converse, constants } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { updateSettingsWithFormData, validateJID } from './utils.js';
import tplLoginPanel from './templates/loginform.js';

import './styles/loginform.scss';

const { Strophe } = converse.env;
const { ANONYMOUS } = constants;


class LoginForm extends CustomElement {

    initialize () {
        const settings = api.settings.get();
        this.listenTo(settings, 'change:show_connection_url_input', () => this.requestUpdate());
        this.listenTo(_converse.state.connfeedback, 'change', () => this.requestUpdate());
        this.handler = () => this.requestUpdate()
    }

    connectedCallback () {
        super.connectedCallback();
        api.settings.listen.on('change', this.handler);
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        api.settings.listen.not('change', this.handler);
    }

    render () {
        return tplLoginPanel(this);
    }

    firstUpdated () {
        this.initPopovers();
    }

    /**
     * @param {SubmitEvent} ev
     */
    async onLoginFormSubmitted (ev) {
        ev?.preventDefault();

        if (api.settings.get('authentication') === ANONYMOUS) {
            const jid = _converse.session.get('jid');
            return this.connect(jid);
        }

        const form = /** @type {HTMLFormElement} */(ev.target);
        if (!validateJID(form)) {
            return;
        }
        updateSettingsWithFormData(form);

        if (!api.settings.get('bosh_service_url') && !api.settings.get('websocket_url')) {
            // We don't have a connection URL available, so we try here to discover
            // XEP-0156 connection methods now, and if not found we present the user
            // with the option to enter their own connection URL
            await this.discoverConnectionMethods(form);
        }

        if (api.settings.get('bosh_service_url') || api.settings.get('websocket_url')) {
            // FIXME: The connection class will still try to discover XEP-0156 connection methods
            this.connect();
        } else {
            api.settings.set('show_connection_url_input', true);
        }
    }

    /**
     * @param {HTMLFormElement} form
     */
    discoverConnectionMethods (form) {
        if (!api.settings.get("discover_connection_methods")) {
            return;
        }
        const form_data = new FormData(form);
        const jid = form_data.get('jid');
        if (jid instanceof File) throw new Error('Found file instead of string for "jid" field in form');

        const domain = Strophe.getDomainFromJid(jid);
        api.connection.init(jid);
        return api.connection.get().discoverConnectionMethods(domain);
    }

    initPopovers () {
        Array.from(this.querySelectorAll('[data-toggle="popover"]')).forEach(el => new Popover(el));
    }

    /**
     * @param {string} [jid]
     */
    connect (jid) {
        if (['converse/login', 'converse/register'].includes(location.hash)) {
            history.pushState(null, '', window.location.pathname);
        }
        api.connection.get()?.reset();
        api.user.login(jid);
    }
}

api.elements.define('converse-login-form', LoginForm);

export default LoginForm;
