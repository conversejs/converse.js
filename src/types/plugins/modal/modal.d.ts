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
    state: Model<import("@converse/skeletor").ModelAttributes>;
    onKeyDown: (ev: KeyboardEvent) => void;
    initialized: Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    get modal(): Modal;
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
     * @param {string|null} [message]
     * @param {'info'|'primary'|'secondary'|'danger'} type
     * @param {boolean} [is_ephemeral=true]
     */
    alert(message?: string | null, type?: "info" | "primary" | "secondary" | "danger", is_ephemeral?: boolean): void;
    alertTimeout: number;
    show(): Promise<void>;
    #private;
}
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/headless';
//# sourceMappingURL=modal.d.ts.map