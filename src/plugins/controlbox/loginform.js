import bootstrap from 'bootstrap.native';
import tplLoginPanel from './templates/loginform.js';
import { ANONYMOUS } from '@converse/headless/shared/constants';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api, converse } from '@converse/headless';
import { updateSettingsWithFormData, validateJID } from './utils.js';

const { Strophe } = converse.env;


class LoginForm extends CustomElement {

    initialize () {
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

    async onLoginFormSubmitted (ev) {
        ev?.preventDefault();

        if (api.settings.get('authentication') === ANONYMOUS) {
            const jid = _converse.session.get('jid');
            return this.connect(jid);
        }

        if (!validateJID(ev.target)) {
            return;
        }
        updateSettingsWithFormData(ev.target);

        if (!api.settings.get('bosh_service_url') && !api.settings.get('websocket_url')) {
            // We don't have a connection URL available, so we try here to discover
            // XEP-0156 connection methods now, and if not found we present the user
            // with the option to enter their own connection URL
            await this.discoverConnectionMethods(ev);
        }

        if (api.settings.get('bosh_service_url') || api.settings.get('websocket_url')) {
            // FIXME: The connection class will still try to discover XEP-0156 connection methods
            this.connect();
        } else {
            api.settings.set('show_connection_url_input', true);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    discoverConnectionMethods (ev) {
        if (!api.settings.get("discover_connection_methods")) {
            return;
        }
        const form_data = new FormData(ev.target);
        const jid = form_data.get('jid');
        if (jid instanceof File) throw new Error('Found file instead of string for "jid" field in form');

        const domain = Strophe.getDomainFromJid(jid);
        api.connection.init(jid);
        return api.connection.get().discoverConnectionMethods(domain);
    }

    initPopovers () {
        Array.from(this.querySelectorAll('[data-title]')).forEach(el => {
            new bootstrap.Popover(el, {
                'trigger': (api.settings.get('view_mode') === 'mobile' && 'click') || 'hover',
                'dismissible': (api.settings.get('view_mode') === 'mobile' && true) || false,
                'container': this.parentElement.parentElement.parentElement,
            });
        });
    }

    connect (jid) {
        if (['converse/login', 'converse/register'].includes(location.hash)) {
            history.pushState(null, '', window.location.pathname);
        }
        api.connection.get()?.reset();
        api.user.login(jid);
    }
}

api.elements.define('converse-login-form', LoginForm);
