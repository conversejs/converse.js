import { Model } from "@converse/skeletor";
import { getUniqueId } from "../../utils/index.js";
import u from "../../utils/index.js";

export default class MAMPlaceholderMessage extends Model {
    defaults() {
        return {
            msgid: getUniqueId(),
            is_ephemeral: false,
        };
    }

    async fetchMissingMessages() {
        this.set("fetching", true);
        const options = {
            rsm: {
                before: this.get("before") ?? "", // We always query backwards (newest first)
            },
            mam: {
                start: this.get("start"),
            },
        };
        await u.mam.fetchArchivedMessages(this.collection.chatbox, options);
        this.destroy();
    }
}
