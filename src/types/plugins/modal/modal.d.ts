export default BaseModal;
export type TemplateResult = import('lit-html').TemplateResult;
declare class BaseModal extends ElementView {
    constructor(options: any);
    model: any;
    initialized: any;
    modal: Modal;
    /**
     * @returns {TemplateResult|string}
     */
    renderModal(): TemplateResult | string;
    /**
     * @returns {TemplateResult|string}
     */
    renderModalFooter(): TemplateResult | string;
    toHTML(): import("lit").TemplateResult<1>;
    /**
     * @returns {string|TemplateResult}
     */
    getModalTitle(): string | TemplateResult;
    switchTab(ev: any): void;
    tab: any;
    insertIntoDOM(): void;
    /**
     * @param {string} message
     * @param {'primary'|'secondary'|'danger'} type
     */
    alert(message: string, type?: 'primary' | 'secondary' | 'danger'): void;
    show(): Promise<void>;
}
import { ElementView } from "@converse/skeletor";
import { Modal } from "bootstrap.native";
//# sourceMappingURL=modal.d.ts.map