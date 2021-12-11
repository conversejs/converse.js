import bootstrap from 'bootstrap.native';
import tpl_login_panel from './templates/loginform.js';
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';

const { Strophe, u } = converse.env;


class LoginForm extends CustomElement {

    initialize () {
        this.model = new Model();
        this.listenTo(_converse.connfeedback, 'change', () => this.requestUpdate());
        this.listenTo(this.model, 'change', () => this.requestUpdate());
    }

    render () {
        return tpl_login_panel(this);
    }

    firstUpdated () {
        this.initPopovers();
    }

    async onLoginFormSubmitted (ev) {
        ev?.preventDefault();
        if (api.settings.get('bosh_service_url') ||
                api.settings.get('websocket_url') ||
                this.model.get('show_connection_url_input')) {
            // The connection class will still try to discover XEP-0156 connection methods
            this.authenticate(ev);
        } else {
            // We don't have a connection URL available, so we try here to discover
            // XEP-0156 connection methods now, and if not found we present the user
            // with the option to enter their own connection URL
            await this.discoverConnectionMethods(ev);
            if (api.settings.get('bosh_service_url') || api.settings.get('websocket_url')) {
                this.authenticate(ev);
            } else {
                this.model.set('show_connection_url_input', true);
            }
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

    validate () {
        const form = this.querySelector('form');
        const jid_element = form.querySelector('input[name=jid]');
        if (
            jid_element.value &&
            !api.settings.get('locked_domain') &&
            !api.settings.get('default_domain') &&
            !u.isValidJID(jid_element.value)
        ) {
            jid_element.setCustomValidity(__('Please enter a valid XMPP address'));
            return false;
        }
        jid_element.setCustomValidity('');
        return true;
    }

    /**
     * Authenticate the user based on a form submission event.
     * @param { Event } ev
     */
    authenticate (ev) {
        if (api.settings.get('authentication') === _converse.ANONYMOUS) {
            return this.connect(_converse.jid, null);
        }
        if (!this.validate()) {
            return;
        }

        const form_data = new FormData(ev.target);
        const connection_url  = form_data.get('connection-url');
        if (connection_url?.startsWith('ws')) {
            api.settings.set('websocket_url', connection_url);
        } else if (connection_url?.startsWith('http')) {
            api.settings.set('bosh_service_url', connection_url);
        }

        _converse.config.save({ 'trusted': (form_data.get('trusted') && true) || false });

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
    }

    // eslint-disable-next-line class-methods-use-this
    connect (jid, password) {
        if (['converse/login', 'converse/register'].includes(_converse.router.history.getFragment())) {
            _converse.router.navigate('', { 'replace': true });
        }
        _converse.connection && _converse.connection.reset();
        api.user.login(jid, password);
    }
}

api.elements.define('converse-login-panel', LoginForm);
