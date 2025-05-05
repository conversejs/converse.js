export default class Confirm extends BaseModal {
    constructor(options: any);
    confirmation: Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    renderModalFooter(): string;
    /**
     * @param {SubmitEvent} ev
     */
    onConfimation(ev: SubmitEvent): void;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=confirm.d.ts.map