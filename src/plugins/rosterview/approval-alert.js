import { RosterContact, _converse, api, converse} from '@converse/headless';
import { CustomElement } from 'shared/components/element';
import { declineContactRequest } from 'plugins/rosterview/utils.js';
import tplApprovalAlert from './templates/approval-alert.js';
import tplUnsavedAlert from './templates/unsaved-alert.js';

const { u } = converse.env;

import './styles/approval-alert.scss';

export default class ContactApprovalAlert extends CustomElement {
    static properties = {
        contact: { type: RosterContact },
    };

    constructor() {
        super();
        this.contact = null;
    }

    initialize() {
        super.initialize();
        this.listenTo(this.contact, 'change', () => this.requestUpdate());
    }

    render() {
        if (this.contact.get('requesting')) {
            return tplApprovalAlert(this);
        } else if (u.roster.isUnsavedContact(this.contact)) {
            if (this.contact.get('hide_contact_add_alert')) return '';
            return tplUnsavedAlert(this);
        }
        return '';
    }

    /**
     * @param {MouseEvent} ev
     */
    async acceptRequest(ev) {
        ev.preventDefault();
        api.modal.show('converse-accept-contact-request-modal', { contact: this.contact }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    async declineRequest(ev) {
        ev.preventDefault();
        declineContactRequest(this.contact);
    }

    /**
     * @param {MouseEvent} ev
     * */
    showAddContactModal(ev) {
        ev.preventDefault();
        api.modal.show('converse-add-contact-modal', { contact: this.contact }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    async close(ev) {
        ev.preventDefault();
        this.contact.save({ hide_contact_add_alert: true });
    }
}

api.elements.define('converse-contact-approval-alert', ContactApprovalAlert);
