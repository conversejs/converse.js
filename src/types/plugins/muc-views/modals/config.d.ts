export default class MUCConfigModal extends BaseModal {
    /**
     * @typedef {import('@converse/headless/types/plugins/vcard/api').VCardData} VCardData
     */
    constructor(options: any);
    addListeners(): void;
    renderModal(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Map<string, any>} changed
     */
    shouldUpdate(changed: Map<string, any>): boolean;
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
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=config.d.ts.map