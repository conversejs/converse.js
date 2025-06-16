export default class ContactApprovalAlert extends CustomElement {
    static properties: {
        contact: {
            type: typeof RosterContact;
        };
    };
    contact: any;
    initialize(): void;
    render(): import("lit-html").TemplateResult<1> | "";
    /**
     * @param {MouseEvent} ev
     */
    acceptRequest(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    declineRequest(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     * */
    showAddContactModal(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    close(ev: MouseEvent): Promise<void>;
}
import { CustomElement } from 'shared/components/element';
import { RosterContact } from '@converse/headless';
//# sourceMappingURL=approval-alert.d.ts.map