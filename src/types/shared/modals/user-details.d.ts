export default class UserDetailsModal extends BaseModal {
    constructor(options: any);
    addListeners(): void;
    getContact(): any;
    /**
     * @param {Map<string, any>} changed
     */
    shouldUpdate(changed: Map<string, any>): boolean;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {import('@converse/headless/types/plugins/roster/contact').default} contact
     */
    registerContactEventHandlers(contact: import("@converse/headless/types/plugins/roster/contact").default): void;
    /**
     * @param {MouseEvent} ev
     */
    addContact(ev: MouseEvent): Promise<void>;
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
    /**
     * @param {MouseEvent} ev
     */
    acceptContactRequest(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    declineContactRequest(ev: MouseEvent): Promise<void>;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=user-details.d.ts.map