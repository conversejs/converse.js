export default BaseModal;
export type TemplateResult = import('lit-html').TemplateResult;
declare class BaseModal extends ElementView {
    constructor(options: any);
    model: any;
    initialized: any;
    modal: any;
    toHTML(): import("lit-html").TemplateResult<1>;
    /**
     * @returns {string|TemplateResult}
     */
    getModalTitle(): string | TemplateResult;
    switchTab(ev: any): void;
    tab: any;
    onHide(): void;
    insertIntoDOM(): void;
    alert(message: any, type?: string): void;
    show(): Promise<void>;
}
import { ElementView } from "@converse/skeletor";
//# sourceMappingURL=modal.d.ts.map