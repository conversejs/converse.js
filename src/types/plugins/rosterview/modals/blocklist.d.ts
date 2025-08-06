export default class BlockListModal extends BaseModal {
    static get properties(): {
        filter_text: {
            type: StringConstructor;
        };
        model: {
            type: typeof import("@converse/headless").Model;
        };
    };
    constructor();
    filter_text: string;
    initialize(): Promise<void>;
    blocklist: any;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {MouseEvent} ev
     */
    unblockUsers(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    toggleSelectAll(ev: MouseEvent): void;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=blocklist.d.ts.map