export default ModelWithContact;
declare class ModelWithContact extends Model {
    rosterContactAdded: any;
    contact: any;
    vcard: any;
    /**
     * @param {string} jid
     */
    setRosterContact(jid: string): Promise<void>;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=model-with-contact.d.ts.map