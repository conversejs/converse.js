import tplMUCPasswordForm from './templates/muc-password-form.js';
import { CustomElement } from 'shared/components/element';
import { _converse, api } from '@converse/headless';

class MUCPasswordForm extends CustomElement {
    static get properties () {
        return {
            'jid': { type: String },
        };
    }

    constructor () {
        super();
        this.jid = null;
    }

    connectedCallback () {
        super.connectedCallback();
        const { chatboxes } = _converse.state;
        this.model = chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:password_validation_message', () => this.requestUpdate());
        this.requestUpdate();
    }

    render () {
        return tplMUCPasswordForm({
            'jid': this.model.get('jid'),
            'submitPassword': (ev) => this.submitPassword(ev),
            'validation_message': this.model.get('password_validation_message'),
        });
    }

    submitPassword (ev) {
        ev.preventDefault();
        const password = /** @type {HTMLInputElement} */ (this.querySelector('input[type=password]')).value;
        this.model.join(this.model.get('nick'), password);
        this.model.set('password_validation_message', null);
    }
}

api.elements.define('converse-muc-password-form', MUCPasswordForm);

export default MUCPasswordForm;
