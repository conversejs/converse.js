export default class EmojiPickerDropdown extends DropdownBase {
    static get properties(): {
        message_model: {
            type: ObjectConstructor;
        };
    };
    /** @type {BaseMessage|null} */
    message_model: BaseMessage | null;
    /**
     * @returns {ChatBoxOrMUC|undefined}
     */
    get chatbox(): import("@converse/headless/types/shared/types").ChatBoxOrMUC;
    /**
     * @returns {string[]|undefined}
     */
    get allowed_emojis(): string[];
    /**
     * @returns {import('lit').TemplateResult}
     */
    render(): import("lit").TemplateResult;
    firstUpdated(): void;
    #private;
}
export type BaseMessage = import("@converse/headless/types/shared/message").default;
export type ChatBoxOrMUC = import("@converse/headless/types/shared/types").ChatBoxOrMUC;
import DropdownBase from 'shared/components/dropdownbase.js';
//# sourceMappingURL=emoji-picker-dropdown.d.ts.map