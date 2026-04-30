import tplPasswordReset from './templates/password-reset.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse, log } from '@converse/headless';

const { Strophe, stx, sizzle, u } = converse.env;


class PasswordReset extends CustomElement {

    static get properties () {
        return {
            passwords_mismatched: { type: Boolean },
            alert_message: { type: String }
        }
    }

    initialize () {
        this.passwords_mismatched = false;
        this.alert_message = '';
    }

    render () {
        return tplPasswordReset(this);
    }

    checkPasswordsMatch (ev) {
        const form_data = new FormData(ev.target.form ?? ev.target);
        const password = form_data.get('password');
        const password_check = form_data.get('password_check');

        this.passwords_mismatched = password && password !== password_check;
        return this.passwords_mismatched
    }

    async onSubmit (ev) {
        ev.preventDefault();

        if (this.checkPasswordsMatch(ev)) return;

        const domain = _converse.session.get('domain');
        const iq = stx`
            <iq type="get" to="${domain}" xmlns="jabber:client">
                <query xmlns="${Strophe.NS.REGISTER}"></query>
            </iq>`;
        const iq_response = await api.sendIQ(iq);

        if (iq_response === null) {
            this.alert_message = __('Timeout error');
            return;
        } else if (sizzle(`error service-unavailable[xmlns="${Strophe.NS.STANZAS}"]`, iq_response).length) {
            this.alert_message = __('Your server does not support password reset');
            return;
        } else if (u.isErrorStanza(iq_response)) {
            this.alert_message = __('Your server responded with an unknown error, check the console for details');
            log.error("Could not set password");
            log.error(iq_response);
            return;
        }

        const username = iq_response.querySelector('username').textContent;

        const data = new FormData(ev.target);
        const password = data.get('password');

        const reset_iq = stx`
            <iq type="set" to="${domain}" xmlns="jabber:client">
                <query xmlns="${Strophe.NS.REGISTER}">
                    <username>${username}</username>
                    <password>${password}</password>
                </query>
            </iq>`;

        const iq_result = await api.sendIQ(reset_iq);
        if (iq_result === null) {
            this.alert_message = __('Timeout error while trying to set your password');
        } else if (sizzle(`error not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, iq_result).length) {
            this.alert_message = __('Your server does not allow password reset');
        } else if (sizzle(`error forbidden[xmlns="${Strophe.NS.STANZAS}"]`, iq_result).length) {
            this.alert_message = __('You are not allowed to change your password');
        } else if (u.isErrorStanza(iq_result)) {
            this.alert_message = __('You are not allowed to change your password');
        } else {
            api.alert('info', __('Success'), [__('Your new password has been set')]);
        }
    }
}

api.elements.define('converse-change-password-form', PasswordReset);
