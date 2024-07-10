export default class MUCConfigModal extends BaseModal {
    renderModal(): import("lit").TemplateResult<1>;
    connectedCallback(): void;
    getModalTitle(): any;
    getConfig(): Promise<void>;
    /**
     * @param {SubmitEvent} ev
     */
    setAvatar(ev: SubmitEvent): Promise<void>;
    /**
     * @param {SubmitEvent} ev
     */
    submitConfigForm(ev: SubmitEvent): Promise<void>;
}
export type VCardData = import('@converse/headless/types/plugins/vcard/api').VCardData;
import BaseModal from "plugins/modal/modal.js";
//# sourceMappingURL=config.d.ts.map