export default BaseModal;
declare class BaseModal extends CustomElement {
    /**
     * @typedef {import('lit').TemplateResult} TemplateResult
     */
    static get properties(): {
        model: {
            type: typeof Model;
        };
    };
    /**
     * @param {Object} options
     */
    constructor(options: any);
    model: any;
    initialized: any;
    get modal(): Modal;
    initialize(): void;
    /**
     * @returns {TemplateResult|string}
     */
    renderModal(): import("lit").TemplateResult<1 | 2> | string;
    /**
     * @returns {TemplateResult|string}
     */
    renderModalFooter(): import("lit").TemplateResult<1 | 2> | string;
    render(): import("lit").TemplateResult<1>;
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
    #private;
}
import { CustomElement } from 'shared/components/element.js';
import { Modal } from "bootstrap";
import { Model } from '@converse/skeletor';
//# sourceMappingURL=modal.d.ts.map