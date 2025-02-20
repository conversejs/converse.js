export default class ProfileModal extends BaseModal {
    /**
     * @typedef {import('@converse/headless/types/plugins/vcard/api').VCardData} VCardData
     * @typedef {import("@converse/headless").XMPPStatus} XMPPStatus
     */
    constructor(options: any);
    renderModal(): import("lit").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {VCardData} data
     */
    setVCard(data: import("@converse/headless/types/plugins/vcard/api").VCardData): Promise<void>;
    /**
     * @param {SubmitEvent} ev
     */
    onFormSubmitted(ev: SubmitEvent): Promise<void>;
}
import BaseModal from "plugins/modal/modal.js";
//# sourceMappingURL=profile.d.ts.map