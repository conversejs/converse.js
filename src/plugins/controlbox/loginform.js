import bootstrap from 'bootstrap.native';
import tpl_login_panel from './templates/loginform.js';
import { ElementView } from '@converse/skeletor/src/element';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';
import { render } from 'lit';

const { Strophe, u } = converse.env;


class LoginForm extends ElementView {
    id = 'converse-login-panel';
    className = 'controlbox-pane fade-in row no-gutters';
    events = {
        'submit form#converse-login': 'authenticate',
        'change input': 'validate',
    };

    initialize () {
        this.listenTo(_converse.connfeedback, 'change', this.render);
        this.render();
        this.initPopovers();
    }

    render () {
        render(tpl_login_panel(), this);
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
        ev?.preventDefault();
        if (api.settings.get('authentication') === _converse.ANONYMOUS) {
            return this.connect(_converse.jid, null);
        }
        if (!this.validate()) {
            return;
        }

        const form_data = new FormData(ev.target);
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
