import { constants, Model } from "@converse/headless";

export default class BookmarksPinListModel extends Model {
    defaults () {
        return {
            toggle_state: constants.OPENED,
        }
    }
}
