/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import 'modals/user-details.js';
import 'plugins/profile/index.js';
import BaseModal from "plugins/modal/base.js";
import { modal_close_button } from "plugins/modal/templates/buttons.js";
import log from '@converse/headless/log';
import { CustomElement } from 'shared/components/element.js';
import { html } from "lit";
import { _converse, api, converse } from '@converse/headless/core';
const u = converse.env.utils;

const { Strophe, $iq } = converse.env;


converse.plugins.add('converse-passwordreset', {
    enabled (_converse) {
        return (
            !_converse.api.settings.get('blacklisted_plugins').includes('converse-changepassword')
        );
    },

    dependencies: [],


    initialize () {
    }
});

const password_match_error = (el) => {
	return html`
		<span class='error'>The two passwords entered must match.</span>
	`
}

const confirm_sure = (el) => {
	return html`
		<span>Are you sure?</span>
	`
}

class Profile extends CustomElement {

	async initialize () {
		this.confirmation_active = false;
		this.passwords_mismatched = false;
	}


        render () {
                return ((el) => {
                        return html`
                        <form class="converse-form passwordreset-form" @submit=${el.onSubmit}>
			    <fieldset class="form-group">
				<label for="converse_passwordreset_password">Password</label>
				<input class="form-control" type="password" value="" name="password" required="required" id="converse_passwordreset_password">
				<label for="converse_passwordreset_password_check">Re-type Password</label>
				<input class="form-control" type="password" value="" name="password_check" @input=${el.checkPasswordsMatch} required="required" id="converse_passwordreset_password_check">
                                ${(el.passwords_mismatched) ? password_match_error(el) : ''}
			    </fieldset>
			    ${(el.confirmation_active) ? confirm_sure(el) : ''}
			    ${modal_close_button}
		            <input class="save-form btn btn-primary" type="submit" value=${(this.confirmation_active) ? "I'm sure." : "Submit"}>
			</form>`;
		})(this);

	}

	async checkPasswordsMatch (ev) {
		let form_data = new FormData(ev.target.form);
		let password = form_data.get('password');
		let password_check = form_data.get("password_check");

		if (password != password_check) {
			this.passwords_mismatched = true;
			this.confirmation_active = false;
		} else {
			this.passwords_mismatched = false;
		}
		this.requestUpdate();
	}

	async onSubmit (ev) {
		ev.preventDefault();

		let password = new FormData(ev.target).get('password');
		let password_check = new FormData(ev.target).get("password_check");

		if (password === password_check) {
			if (this.confirmation_active) {
				await this.postNewInfo(password);
				this.confirmation_active = false;
			} else {
				this.confirmation_active = true;
			}
		} else {
			this.passwords_mismatched = true;
			this.confirmation_active = false;
		}
		this.requestUpdate();

	}

	async postNewInfo (password) {
		let domain = Strophe.getDomainFromJid(_converse.bare_jid);
		let iq = $iq({ 'type': 'get', 'to': domain })
			    .c('query', { 'xmlns': 'jabber:iq:register' });
		let response = await _converse.api.sendIQ(iq);
		let username = response.querySelector("username").innerHTML;

		let resetiq = $iq({ 'type': 'set', 'to': domain })
				 .c('query', { 'xmlns': 'jabber:iq:register' })
				 .c('username', {}, username)
				 .c('password', {}, password)

		let iq_result = await _converse.api.sendIQ(resetiq);
                if (iq_result  === null) {
		        api.alert('info', "Password reset failed.", ["Timeout on password reset. Check your connection?"]);
                } else if (u.isErrorStanza(iq_result)) {
                        api.alert('info', "Permission Denied.", ["Either your former password was incorrect, or you may not change your password."]);
                } else {
		        api.alert('info', "Password reset.", ["Your password has been reset."]);
                }
	}

}

api.elements.define("converse-changepassword-profile", Profile);

