export default class ProfileModal extends BaseModal {
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