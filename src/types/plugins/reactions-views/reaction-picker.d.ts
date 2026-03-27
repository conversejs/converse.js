export default class ReactionPicker extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        dropup: {
            type: BooleanConstructor;
        };
        shifted: {
            type: BooleanConstructor;
        };
        opened: {
            type: BooleanConstructor;
        };
    };
    model: any;
    picker_id: string;
    dropup: boolean;
    shifted: boolean;
    opened: boolean;
    onClickOutside: (ev: MouseEvent) => void;
    /**
     * Render the reaction picker UI
     * @returns {Object} Lit HTML template
     */
    render(): any;
    updated(changed: any): void;
    open(ev: any): Promise<void>;
    close(): void;
    positionPicker(): void;
    get allowed_emojis(): any;
    initEmojiPicker(): Promise<void>;
    onEmojiSelected(emoji: any): void;
    #private;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=reaction-picker.d.ts.map