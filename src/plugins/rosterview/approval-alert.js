import { RosterContact, _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element';
import { declineContactRequest } from 'plugins/rosterview/utils.js';
import tplApprovalAlert from './templates/approval-alert.js';

import './styles/approval-alert.scss';

export default class ContactApprovalAlert extends CustomElement {
    static properties = {
        contact: { type: RosterContact },
    };

    constructor() {
        super();
        this.contact = null;
    }

    render() {
        return tplApprovalAlert(this);
    }

    /**
     * @param {MouseEvent} ev
     */
    async acceptRequest(ev) {
        ev?.preventDefault?.();
        api.modal.show('converse-accept-contact-request-modal', { contact: this.contact }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    async declineRequest(ev) {
        ev?.preventDefault?.();
        declineContactRequest(this.contact);
    }
}

api.elements.define('converse-contact-approval-alert', ContactApprovalAlert);
