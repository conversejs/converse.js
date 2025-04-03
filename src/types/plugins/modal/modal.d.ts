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
    initialized: Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    get modal(): Modal;
    initialize(): void;
    /**
     * @returns {TemplateResult|string}
     */
    renderModal(): import("lit-html").TemplateResult<1 | 2 | 3> | string;
    /**
     * @returns {TemplateResult|string}
     */
    renderModalFooter(): import("lit-html").TemplateResult<1 | 2 | 3> | string;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @returns {string|TemplateResult}
     */
    getModalTitle(): string | import("lit-html").TemplateResult<1 | 2 | 3>;
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
import Modal from "bootstrap/js/src/modal.js";
import { Model } from '@converse/skeletor';
//# sourceMappingURL=modal.d.ts.map