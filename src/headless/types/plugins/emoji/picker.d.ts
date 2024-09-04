export default EmojiPicker;
/**
 * Model for storing data related to the Emoji picker widget
 */
declare class EmojiPicker extends Model {
    defaults(): {
        current_category: string;
        current_skintone: string;
        scroll_position: number;
    };
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=picker.d.ts.map