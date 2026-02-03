export default RoomsListModel;
/**
 * @extends {Model<import("./types").RoomsListAttrs>}
 */
declare class RoomsListModel extends Model<import("./types").RoomsListAttrs> {
    constructor(attributes?: Partial<import("./types").RoomsListAttrs>, options?: import("@converse/skeletor").ModelOptions);
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