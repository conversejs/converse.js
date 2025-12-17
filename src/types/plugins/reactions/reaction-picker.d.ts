import { CustomElement } from '../../../shared/components/element.js';
import { EmojiPicker } from '@converse/headless';

/**
 * ReactionPicker Component
 * @extends CustomElement
 * @fires reactionSelected - Dispatched when user selects an emoji
 */
export default class ReactionPicker extends CustomElement {
    /**
     * Define reactive properties for the component
     * @returns {Object} Property definitions
     *
     * Properties:
     * - target: The button element that triggered the picker (for positioning)
     * - model: The message model being reacted to
     * - emoji_picker_state: State model for the full emoji picker
     */
    static get properties(): any;
    target: any;
    model: any;
    emoji_picker_state: EmojiPicker;
    picker_id: string;
    allowed_emojis: any;
    /**
     * Render the reaction picker UI
     * @returns {Object} Lit HTML template
     *
     * UI Structure:
     * - Popular emojis row (quick selection)
     * - Plus button with dropdown (full emoji picker)
     */
    render(): any;
    /**
     * Initialize the full emoji picker (lazy-loaded)
     * Only loads emoji data when user opens the dropdown
     * This improves initial performance
     *
     * @async
     * @returns {Promise<void>}
     */
    initEmojiPicker(): Promise<void>;
    /**
     * Handle emoji selection
     * Dispatches custom event and closes the dropdown
     *
     * @param {string} emoji - The selected emoji (can be unicode or shortname)
     * @fires reactionSelected
     */
    onEmojiSelected(emoji: string): void;
}


//# sourceMappingURL=reaction-picker.d.ts.map