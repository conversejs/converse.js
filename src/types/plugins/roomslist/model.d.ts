export default RoomsListModel;
declare class RoomsListModel extends Model {
    defaults(): {
        muc_domain: any;
        toggle_state: "opened";
        collapsed_domains: any[];
    };
    initialize(): void;
    /**
     * @param {string} jid
     */
    setDomain(jid: string): void;
}
import { Model } from "@converse/headless";
//# sourceMappingURL=model.d.ts.map