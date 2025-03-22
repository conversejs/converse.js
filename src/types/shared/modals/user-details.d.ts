export default class UserDetailsModal extends BaseModal {
    constructor(options: any);
    addListeners(): void;
    /**
     * @param {Map<string, any>} changed
     */
    shouldUpdate(changed: Map<string, any>): boolean;
    renderModal(): "" | import("lit").TemplateResult<1>;
    getModalTitle(): any;
    registerContactEventHandlers(): void;
    /**
     * @param {MouseEvent} ev
     */
    updateContact(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    removeContact(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    blockContact(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    unblockContact(ev: MouseEvent): Promise<void>;
}
import BaseModal from "plugins/modal/modal.js";
//# sourceMappingURL=user-details.d.ts.map