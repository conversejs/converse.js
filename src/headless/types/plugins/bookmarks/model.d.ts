export default Bookmark;
declare class Bookmark extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    /**
     * @returns {boolean}
     */
    get pinned(): boolean;
    getDisplayName(): any;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=model.d.ts.map