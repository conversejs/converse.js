export default BaseModal;
declare class BaseModal extends CustomElement {
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
    renderModal(): {
        _$litType$: 1 | 2;
        strings: TemplateStringsArray;
        values: unknown[];
    } | string;
    /**
     * @returns {TemplateResult|string}
     */
    renderModalFooter(): {
        _$litType$: 1 | 2;
        strings: TemplateStringsArray;
        values: unknown[];
    } | string;
    render(): import("lit").TemplateResult<1>;
    /**
     * @returns {string|TemplateResult}
     */
    getModalTitle(): string | {
        _$litType$: 1 | 2;
        strings: TemplateStringsArray;
        values: unknown[];
    };
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
//# sourceMappingURL=modal.d.ts.map