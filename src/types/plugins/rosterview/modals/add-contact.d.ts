export default class AddContactModal extends BaseModal {
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    validateSubmission(jid: any): boolean;
    afterSubmission(_form: any, jid: any, name: any, group: any): void;
    addContactFromForm(ev: any): Promise<void>;
}
import BaseModal from "plugins/modal/modal.js";
//# sourceMappingURL=add-contact.d.ts.map