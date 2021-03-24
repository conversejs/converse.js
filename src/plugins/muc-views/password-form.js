import tpl_muc_password_form from "./templates/muc-password-form.js";
import { CustomElement } from 'shared/components/element';
import { _converse, api } from "@converse/headless/core";


class MUCPasswordForm extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:password_validation_message', this.render);
        this.render();
    }

    render () {
        return tpl_muc_password_form({
            'jid': this.model.get('jid'),
            'submitPassword': ev => this.submitPassword(ev),
            'validation_message':  this.model.get('password_validation_message')
        });
    }

    submitPassword (ev) {
        ev.preventDefault();
        const password = this.querySelector('input[type=password]').value;
        this.model.join(this.model.get('nick'), password);
        this.model.set('password_validation_message', null);
    }
}

api.elements.define('converse-muc-password-form', MUCPasswordForm);

export default MUCPasswordForm;
