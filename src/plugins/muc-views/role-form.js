import log from '@converse/headless/log';
import tplRoleForm from './templates/role-form.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless/core.js';
import { isErrorObject } from '@converse/headless/utils/core.js';

const { Strophe, sizzle } = converse.env;

class RoleForm extends CustomElement {
    static get properties () {
        return {
            muc: { type: Object },
            jid: { type: String },
            role: { type: String },
            alert_message: { type: String, attribute: false },
            alert_type: { type: String, attribute: false },
        };
    }

    render () {
        return tplRoleForm(this);
    }

    alert (message, type) {
        this.alert_message = message;
        this.alert_type = type;
    }

    assignRole (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.alert(); // clear alert

        const data = new FormData(ev.target);
        const occupant = this.muc.getOccupant(data.get('jid') || data.get('nick'));
        const role = data.get('role');
        const reason = data.get('reason');

        this.muc.setRole(
            occupant,
            role,
            reason,
            () => {
                /**
                 * @event roleChanged
                 * @example
                 *  const el = document.querySelector('converse-muc-role-form');
                 *  el.addEventListener('roleChanged', () => { ... });
                 */
                const event = new CustomEvent('roleChanged', { bubbles: true });
                this.dispatchEvent(event);

            },
            e => {
                if (sizzle(`not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                    this.alert(__("You're not allowed to make that change"), 'danger');
                } else {
                    this.alert(__('Sorry, something went wrong while trying to set the role'), 'danger');
                    if (isErrorObject(e)) log.error(e);
                }
            }
        );

    }
}

api.elements.define('converse-muc-role-form', RoleForm);
