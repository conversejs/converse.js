import { Model } from '@converse/skeletor';

/**
 * Model for storing data related to the Emoji picker widget
 */
class EmojiPicker extends Model {
    defaults () {
        return {
            'current_category': 'smileys',
            'current_skintone': '',
            'scroll_position': 0
        }
    }
}

export default EmojiPicker;
