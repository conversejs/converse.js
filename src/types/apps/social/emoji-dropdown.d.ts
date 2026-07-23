export default class SocialEmojiDropdown extends Dropdown {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        _render_emojis: {
            type: BooleanConstructor;
            state: boolean;
        };
        icon_classes: {
            type: StringConstructor;
        };
        items: {
            type: ArrayConstructor;
        };
    };
    dropdown_id: string;
    model: any;
    /** @type {EmojiPicker|null} */
    _state: EmojiPicker | null;
    _render_emojis: boolean;
    /**
     * Lazily create and fetch the per-account emoji-picker state. It is storage-backed,
     * so the chosen category/skin-tone/query persist across opens and page loads.
     * @returns {Promise<EmojiPicker>}
     */
    initState(): Promise<EmojiPicker>;
    onShown(): Promise<void>;
    /**
     * The shared picker's `emojiSelected` bubbles up to `document`, where chat's
     * message-form listens for it. Stop it here (so a social emoji never lands in an
     * open chat's textarea) and re-emit the resolved glyph for the composer.
     * @param {CustomEvent} ev
     */
    onEmojiSelected(ev: CustomEvent): void;
}
import Dropdown from 'shared/components/dropdown.js';
import { EmojiPicker } from '@converse/headless';
//# sourceMappingURL=emoji-dropdown.d.ts.map