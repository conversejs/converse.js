export default class AddContactModal extends BaseModal {
    renderModal(): import("lit").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {string} jid
     */
    validateSubmission(jid: string): boolean;
    /**
     * @param {HTMLFormElement} _form
     * @param {string} jid
     * @param {string} name
     * @param {FormDataEntryValue} group
     */
    afterSubmission(_form: HTMLFormElement, jid: string, name: string, group: FormDataEntryValue): Promise<void>;
    /**
     * @param {Event} ev
     */
    addContactFromForm(ev: Event): Promise<void>;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=add-contact.d.ts.map