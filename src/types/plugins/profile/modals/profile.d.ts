export default class ProfileModal extends BaseModal {
    /**
     * @typedef {import('@converse/headless/types/plugins/vcard/types').VCardData} VCardData
     * @typedef {import("@converse/headless").Profile} Profile
     * @typedef {import("lit").TemplateResult} TemplateResult
     */
    static properties: {
        _submitting: {
            state: boolean;
        };
        _show_clear_button: {
            type: BooleanConstructor;
            state: boolean;
        };
        model: {
            type: typeof Model;
        };
        tab: {
            type: StringConstructor;
        };
    };
    _show_clear_button: boolean;
    /**
     * @param {Map<string, boolean>} changed - A map of changed properties.
     */
    willUpdate(changed: Map<string, boolean>): void;
    getModalTitle(): any;
    /**
     * @returns {TemplateResult}
     */
    renderModal(): {
        _$litType$: 1 | 2 | 3;
        strings: TemplateStringsArray;
        values: unknown[];
    };
    /**
     * @param {VCardData} data
     */
    setVCard(data: import("@converse/headless/types/plugins/vcard/types").VCardData): Promise<boolean>;
    /**
     * @param {SubmitEvent} ev
     */
    onProfileFormSubmitted(ev: SubmitEvent): Promise<void>;
    _submitting: boolean;
    /**
     * @param {SubmitEvent} ev
     */
    onStatusFormSubmitted(ev: SubmitEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    clearStatusMessage(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    logOut(ev: MouseEvent): Promise<void>;
}
import BaseModal from 'plugins/modal/modal.js';
import { Model } from '@converse/skeletor';
//# sourceMappingURL=profile.d.ts.map