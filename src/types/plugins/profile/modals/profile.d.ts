export default class ProfileModal extends BaseModal {
    constructor(options: any);
    renderModal(): import("lit").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {VCardData} data
     */
    setVCard(data: VCardData): Promise<void>;
    /**
     * @param {SubmitEvent} ev
     */
    onFormSubmitted(ev: SubmitEvent): Promise<void>;
}
export type VCardData = import('@converse/headless/types/plugins/vcard/api').VCardData;
export type XMPPStatus = import("@converse/headless").XMPPStatus;
import BaseModal from "plugins/modal/modal.js";
//# sourceMappingURL=profile.d.ts.map