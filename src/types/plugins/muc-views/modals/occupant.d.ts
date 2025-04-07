export default class OccupantModal extends BaseModal {
    constructor(options: any);
    message: any;
    renderModal(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    openChat(ev: MouseEvent): void;
    getVcard(): any;
    getModalTitle(): any;
    addToContacts(): void;
    toggleForm(ev: any): void;
    show_role_form: any;
    show_affiliation_form: any;
}
import BaseModal from "plugins/modal/modal.js";
//# sourceMappingURL=occupant.d.ts.map