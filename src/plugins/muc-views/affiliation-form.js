import log from '@converse/headless/log';
import tplAffiliationForm from './templates/affiliation-form.js';
import { CustomElement } from 'shared/components/element';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless/core';
import { setAffiliation } from '@converse/headless/plugins/muc/affiliations/utils.js';

const { Strophe, sizzle } = converse.env;

class AffiliationForm extends CustomElement {
    static get properties () {
        return {
            muc: { type: Object },
            jid: { type: String },
            affiliation: { type: String },
            alert_message: { type: String, attribute: false },
            alert_type: { type: String, attribute: false },
        };
    }

    render () {
        return tplAffiliationForm(this);
    }

    alert (message, type) {
        this.alert_message = message;
        this.alert_type = type;
    }

    async assignAffiliation (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.alert(); // clear alert messages

        const data = new FormData(ev.target);
        const affiliation = data.get('affiliation');
        const attrs = {
            jid: this.jid,
            reason: data.get('reason'),
        };
        const muc_jid = this.muc.get('jid');
        try {
            await setAffiliation(affiliation, muc_jid, [attrs]);
        } catch (e) {
            if (e === null) {
                this.alert(__('Timeout error while trying to set the affiliation'), 'danger');
            } else if (sizzle(`not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                this.alert(__("Sorry, you're not allowed to make that change"), 'danger');
            } else {
                this.alert(__('Sorry, something went wrong while trying to set the affiliation'), 'danger');
            }
            log.error(e);
            return;
        }

        await this.muc.occupants.fetchMembers();

        /**
         * @event affiliationChanged
         * @example
         *  const el = document.querySelector('converse-muc-affiliation-form');
         *  el.addEventListener('affiliationChanged', () => { ... });
         */
        const event = new CustomEvent('affiliationChanged', { bubbles: true });
        this.dispatchEvent(event);
    }
}

api.elements.define('converse-muc-affiliation-form', AffiliationForm);
