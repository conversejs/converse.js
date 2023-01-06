export default class MAMPlaceholderMessage extends Model {
    defaults(): {
        msgid: any;
        is_ephemeral: boolean;
    };
}
import { Model } from "@converse/skeletor/src/model.js";
