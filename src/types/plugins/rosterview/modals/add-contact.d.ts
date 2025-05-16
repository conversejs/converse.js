export default class AddContactModal extends BaseModal {
    constructor();
    contact: any;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {string} jid
     */
    validateSubmission(jid: string): boolean;
    /**
     * @param {string} jid
     * @param {string} name
     * @param {string[]} groups
     */
    afterSubmission(jid: string, name: string, groups: string[]): Promise<void>;
    /**
     * @param {Event} ev
     */
    addContactFromForm(ev: Event): Promise<void>;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=add-contact.d.ts.map