export default RoomsListModel;
declare class RoomsListModel extends Model {
    defaults(): {
        muc_domain: any;
        nick: any;
        toggle_state: string;
        collapsed_domains: any[];
    };
    /**
     * @param {string} jid
     */
    setDomain(jid: string): void;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=model.d.ts.map