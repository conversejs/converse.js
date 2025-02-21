export default RoomsListModel;
declare class RoomsListModel extends Model {
    defaults(): {
        muc_domain: any;
        toggle_state: "opened";
        collapsed_domains: never[];
    };
    /**
     * @param {string} jid
     */
    setDomain(jid: string): void;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=model.d.ts.map