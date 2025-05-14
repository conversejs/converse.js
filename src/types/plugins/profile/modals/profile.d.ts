export default class ProfileModal extends BaseModal {
    /**
     * @typedef {import('@converse/headless/types/plugins/vcard/api').VCardData} VCardData
     * @typedef {import("@converse/headless").Profile} Profile
     */
    static properties: {
        _submitting: {
            state: boolean;
        };
        model: {
            type: typeof Model;
        };
    };
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {VCardData} data
     */
    setVCard(data: import("@converse/headless/types/plugins/vcard/api").VCardData): Promise<boolean>;
    /**
     * @param {SubmitEvent} ev
     */
    onFormSubmitted(ev: SubmitEvent): Promise<void>;
    _submitting: boolean;
}
import BaseModal from "plugins/modal/modal.js";
import { Model } from '@converse/skeletor';
//# sourceMappingURL=profile.d.ts.map