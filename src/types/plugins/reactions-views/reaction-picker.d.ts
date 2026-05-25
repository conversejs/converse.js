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
        popular_reactions_promise: {
            state: boolean;
        };
    };
    /** @type {BaseMessage|null} */
    model: BaseMessage | null;
    picker_id: string;
    dropup: boolean;
    shifted: boolean;
    opened: boolean;
    popular_reactions_promise: Promise<string[]>;
    onClickOutside: (ev: MouseEvent) => void;
    /**
     * Render the reaction picker UI
     * @returns {TemplateResult|''}
     */
    render(): TemplateResult | "";
    /**
     * @param {MouseEvent} ev - The click event that triggered opening
     */
    open(ev: MouseEvent): Promise<void>;
    close(): void;
    positionPicker(): void;
    /**
     * @param {string} emoji - The selected emoji
     */
    onEmojiSelected(emoji: string): void;
    #private;
}
export type BaseMessage = import("@converse/headless/types/shared/message").default;
export type ChatBoxOrMUC = import("@converse/headless/types/shared/types").ChatBoxOrMUC;
export type TemplateResult = import("lit").TemplateResult;
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=reaction-picker.d.ts.map