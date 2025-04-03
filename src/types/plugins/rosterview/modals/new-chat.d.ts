export default class NewChatModal extends BaseModal {
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {string} jid
     */
    validateSubmission(jid: string): boolean;
    /**
     * @param {HTMLFormElement} _form
     * @param {string} jid
     */
    afterSubmission(_form: HTMLFormElement, jid: string): Promise<void>;
    /**
     * @param {SubmitEvent} ev
     */
    startChatFromForm(ev: SubmitEvent): Promise<void>;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=new-chat.d.ts.map