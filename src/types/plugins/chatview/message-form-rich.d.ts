export default class MessageFormRich extends MessageForm {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        is_empty: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    is_empty: boolean;
    /** @type {import('shared/rich-composer/types').RichEditor|null} */
    _handle: import("shared/rich-composer/types").RichEditor | null;
    /** @type {Promise<import('shared/rich-composer/types').RichEditor>|null} */
    _init: Promise<import("shared/rich-composer/types").RichEditor> | null;
    /** Load an externally-set draft into the editor, ignoring the ones we wrote ourselves. */
    onDraftChanged(): Promise<void>;
    updated(): void;
    /**
     * Load Lexical and attach it to the contenteditable host, once. The dynamic import
     * keeps the editor out of the core bundle.
     * @returns {Promise<import('shared/rich-composer/types').RichEditor>}
     */
    ensureEditor(): Promise<import("shared/rich-composer/types").RichEditor>;
    /** Reflect emptiness so the placeholder shows only when there is nothing to send. */
    onChange(): void;
    /** The composer's text, untrimmed, which is what the character counter measures. */
    rawText(): string;
    /**
     * Insert text at the caret. Overrides the textarea implementation, which the emoji
     * dropdown drives through the `emojiSelected` event.
     * @param {string} value
     */
    insertIntoTextArea(value: string): Promise<void>;
    /**
     * Insert `text` at the caret, then mirror the result into the draft.
     *
     * The textarea version writes to `draft` and lets the template render it back, which
     * an attached editor would never see, so the insert has to go through the editor.
     * @param {string} text
     */
    insertAtCaret(text: string): Promise<void>;
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev: KeyboardEvent): any;
}
import MessageForm from './message-form.js';
//# sourceMappingURL=message-form-rich.d.ts.map