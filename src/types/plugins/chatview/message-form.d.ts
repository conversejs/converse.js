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
     * @param {string} value - The value to be inserted.
     * @param {(boolean|string)} [replace] - Whether an existing value
     *  should be replaced. If set to `true`, the entire textarea will
     *  be replaced with the new value. If set to a string, then only
     *  that string will be replaced *if* a position is also specified.
     * @param {number} [position] - The end index of the string to be
     *  replaced with the new value.
     */
    insertIntoTextArea(value: string, replace?: (boolean | string), correcting?: boolean, position?: number, separator?: string): void;
    /**
     * @param {import('@converse/headless').BaseMessage} message
     */
    onMessageCorrecting(message: import("@converse/headless").BaseMessage<any>): void;
    /**
     * Handles the escape key press event to stop correcting a message.
     * @param {KeyboardEvent} ev
     */
    onEscapePressed(ev: KeyboardEvent): void;
    /**
     * Handles the paste event to insert text or files into the chat.
     * @param {ClipboardEvent} ev
     */
    onPaste(ev: ClipboardEvent): void;
    /**
     * Handles the drop event to send files dragged-and-dropped into the chat.
     * @param {DragEvent} ev
     */
    onDrop(ev: DragEvent): void;
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyUp(ev: KeyboardEvent): void;
    /**
     * @param {KeyboardEvent} [ev]
     */
    onKeyDown(ev?: KeyboardEvent): any;
    /**
     * @param {SubmitEvent|KeyboardEvent} ev
     */
    onFormSubmitted(ev: SubmitEvent | KeyboardEvent): Promise<void>;
}
export type EmojiDropdown = import("shared/chat/emoji-dropdown.js").default;
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=message-form.d.ts.map