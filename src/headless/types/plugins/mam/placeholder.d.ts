export default class MAMPlaceholderMessage extends Model {
    defaults(): {
        msgid: string;
        is_ephemeral: boolean;
    };
    fetchMissingMessages(): Promise<void>;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=placeholder.d.ts.map