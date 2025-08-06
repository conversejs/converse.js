export default ControlBox;
/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 */
declare class ControlBox extends Model {
    defaults(): {
        bookmarked: boolean;
        box_id: string;
        chat_state: any;
        closed: boolean;
        num_unread: number;
        time_opened: any;
        type: "controlbox";
        url: string;
    };
    validate(attrs: any): any;
    /**
     * @param {boolean} [force]
     */
    maybeShow(force?: boolean): any;
    onReconnection(): void;
}
import { Model } from '@converse/headless';
//# sourceMappingURL=model.d.ts.map