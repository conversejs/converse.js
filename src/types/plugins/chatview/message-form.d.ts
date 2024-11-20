export default class MessageForm extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    initialize(): Promise<void>;
    handleEmojiSelection: ({ detail }: CustomEvent) => void;
    render(): import("lit").TemplateResult<1>;
    /**
     * Insert a particular string value into the textarea of this chat box.
     * @param { string } value - The value to be inserted.
     * @param {(boolean|string)} [replace] - Whether an existing value
     *  should be replaced. If set to `true`, the entire textarea will
     *  be replaced with the new value. If set to a string, then only
     *  that string will be replaced *if* a position is also specified.
     * @param { number } [position] - The end index of the string to be
     *  replaced with the new value.
     */
    insertIntoTextArea(value: string, replace?: (boolean | string), correcting?: boolean, position?: number, separator?: string): void;
    onMessageCorrecting(message: any): void;
    onEscapePressed(ev: any): void;
    onPaste(ev: any): void;
    onDrop(evt: any): void;
    onKeyUp(ev: any): void;
    onKeyDown(ev: any): any;
    onFormSubmitted(ev: any): Promise<void>;
}
export type EmojiDropdown = import("shared/chat/emoji-dropdown.js").default;
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=message-form.d.ts.map