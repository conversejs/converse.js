export default BaseModal;
declare class BaseModal extends ElementView {
    /**
     * @typedef {import('lit').TemplateResult} TemplateResult
     */
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
    renderModal(): import("lit").TemplateResult<1 | 2> | string;
    /**
     * @returns {TemplateResult|string}
     */
    renderModalFooter(): import("lit").TemplateResult<1 | 2> | string;
    toHTML(): import("lit").TemplateResult<1>;
    /**
     * @returns {string|TemplateResult}
     */
    getModalTitle(): string | import("lit").TemplateResult<1 | 2>;
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