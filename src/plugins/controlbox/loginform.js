import bootstrap from 'bootstrap.native';
import tpl_login_panel from './templates/loginform.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api, converse } from '@converse/headless/core';
import { updateSettingsWithFormData, validateJID } from './utils.js';

const { Strophe, u } = converse.env;


class LoginForm extends CustomElement {

    initialize () {
        this.listenTo(_converse.connfeedback, 'change', () => this.requestUpdate());
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
        return tpl_login_panel(this);
    }

    firstUpdated () {
        this.initPopovers();
    }

    async onLoginFormSubmitted (ev) {
        ev?.preventDefault();

        if (api.settings.get('authentication') === _converse.ANONYMOUS) {
            return this.connect(_converse.jid);
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
    async discoverConnectionMethods (ev) {
        if (!api.settings.get("discover_connection_methods")) {
            return;
        }
        const form_data = new FormData(ev.target);
        const jid = form_data.get('jid');
        const domain = Strophe.getDomainFromJid(jid);
        if (!_converse.connection?.jid || (jid && !u.isSameDomain(_converse.connection.jid, jid))) {
            await _converse.initConnection();
        }
        return _converse.connection.discoverConnectionMethods(domain);
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

    // eslint-disable-next-line class-methods-use-this
    connect (jid) {
        if (['converse/login', 'converse/register'].includes(_converse.router.history.getFragment())) {
            _converse.router.navigate('', { 'replace': true });
        }
        _converse.connection?.reset();
        api.user.login(jid);
    }
}

api.elements.define('converse-login-form', LoginForm);
