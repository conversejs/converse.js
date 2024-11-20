export default class ChatBottomPanel extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    connectedCallback(): Promise<void>;
    initialize(): Promise<void>;
    render(): import("lit").TemplateResult<1> | "";
    sendButtonClicked(ev: any): void;
    viewUnreadMessages(ev: any): void;
    onDragOver(ev: any): void;
    clearMessages(ev: any): void;
    autocompleteInPicker(input: any, value: any): Promise<void>;
}
export type EmojiPicker = import("shared/chat/emoji-picker.js").default;
export type EmojiDropdown = import("shared/chat/emoji-dropdown.js").default;
export type MessageForm = import("./message-form.js").default;
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=bottom-panel.d.ts.map