export default ModelWithContact;
declare class ModelWithContact extends ColorAwareModel {
    rosterContactAdded: any;
    /**
     * @public
     * @type {RosterContact|XMPPStatus}
     */
    public contact: import("../roster/contact").default | import("../status/status.js").default;
    /**
     * @public
     * @type {VCard}
     */
    public vcard: import("../vcard/vcard").default;
    /**
     * @param {string} jid
     */
    setModelContact(jid: string): Promise<void>;
}
import { ColorAwareModel } from '../../shared/color.js';
//# sourceMappingURL=model-with-contact.d.ts.map