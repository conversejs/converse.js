export default class ChatBottomPanel extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    /** @type {Array<import('lit').TemplateResult|string>} */
    plugin_content: Array<import("lit").TemplateResult | string>;
    connectedCallback(): Promise<void>;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1> | "";
    viewUnreadMessages(ev: any): void;
    onDragOver(ev: any): void;
    clearMessages(ev: any): void;
    /**
     * @typedef {Object} AutocompleteInPickerEvent
     * @property {HTMLTextAreaElement} target
     * @property {string} value
     * @param {AutocompleteInPickerEvent} ev
     */
    autocompleteInPicker(ev: {
        target: HTMLTextAreaElement;
        value: string;
    }): Promise<void>;
    #private;
}
export type EmojiPicker = import("shared/chat/emoji-picker.js").default;
export type EmojiDropdown = import("shared/chat/emoji-dropdown.js").default;
export type MessageForm = import("./message-form.js").default;
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=bottom-panel.d.ts.map