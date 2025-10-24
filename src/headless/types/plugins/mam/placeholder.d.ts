export default class MAMPlaceholderMessage extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        msgid: string;
        is_ephemeral: boolean;
    };
    fetchMissingMessages(): Promise<void>;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=placeholder.d.ts.map