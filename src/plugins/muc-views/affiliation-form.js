import { api, converse, log, u } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element';
import tplAffiliationForm from './templates/affiliation-form.js';

import './styles/affiliation-form.scss';

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

    constructor () {
        super();
        this.jid = null;
        this.muc = null;
        this.affiliation = null;
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
        const affiliation = /** @type {string} */(data.get('affiliation'));
        const attrs = {
            jid: this.jid,
            reason: /** @type {string} */(data.get('reason')),
        };
        const muc_jid = this.muc.get('jid');
        try {
            await u.muc.setAffiliation(affiliation, muc_jid, [attrs]);
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

export default AffiliationForm;
