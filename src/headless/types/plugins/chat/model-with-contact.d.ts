export default ModelWithContact;
declare class ModelWithContact extends Model {
    rosterContactAdded: any;
    /**
     * @public
     * @type {RosterContact}
     */
    public contact: import("../roster/contact").default;
    /**
     * @public
     * @type {VCard}
     */
    public vcard: import("../vcard/vcard").default;
    /**
     * @param {string} jid
     */
    setRosterContact(jid: string): Promise<void>;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=model-with-contact.d.ts.map