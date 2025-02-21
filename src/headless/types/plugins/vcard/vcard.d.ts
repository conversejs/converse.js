export default VCard;
declare class VCard extends Model {
    /**
     * @param {import("../../shared/types").ModelAttributes} attrs
     * @param {import("./types").VCardModelOptions} options
     */
    constructor(attrs: import("../../shared/types").ModelAttributes, options: import("./types").VCardModelOptions);
    _vcard: any;
    /**
     * @param {import("../../shared/types").ModelAttributes} [_attrs]
     * @param {import("./types").VCardModelOptions} [options]
     */
    initialize(_attrs?: import("../../shared/types").ModelAttributes, options?: import("./types").VCardModelOptions): void;
    lazy_load: boolean;
    getDisplayName(): any;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=vcard.d.ts.map