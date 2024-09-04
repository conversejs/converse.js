export default BaseModal;
export type TemplateResult = import("lit-html").TemplateResult;
declare class BaseModal extends ElementView {
    /**
     * @param {Object} options
     */
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
    /**
     * @param {Event} [ev]
     */
    switchTab(ev?: Event): void;
    tab: string;
    close(): void;
    insertIntoDOM(): void;
    /**
     * @param {string} message
     * @param {'primary'|'secondary'|'danger'} type
     */
    alert(message: string, type?: "primary" | "secondary" | "danger"): void;
    show(): Promise<void>;
}
import { ElementView } from '@converse/skeletor';
import { Modal } from "bootstrap";
//# sourceMappingURL=modal.d.ts.map