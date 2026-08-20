export default class MessageForm extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        is_empty: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    model: any;
    shiftDown: boolean;
    is_empty: boolean;
    /** @type {import('shared/rich-composer/types').RichEditor|null} */
    _handle: import("shared/rich-composer/types").RichEditor | null;
    /** @type {Promise<import('shared/rich-composer/types').RichEditor>|null} */
    _init: Promise<import("shared/rich-composer/types").RichEditor> | null;
    typeahead: TypeaheadController;
    /**
     * The caret-typeahead sources this composer offers, most specific first (the first
     * whose trigger the caret sits on wins, so triggers must be mutually exclusive).
     * @returns {import('shared/rich-composer/types').TypeaheadSource[]}
     */
    getTypeaheadSources(): import("shared/rich-composer/types").TypeaheadSource[];
    initialize(): Promise<void>;
    handleEmojiSelection: ({ detail }: CustomEvent) => void;
    render(): import("lit-html").TemplateResult<1>;
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
    /**
     * @param {FocusEvent} [ev]
     */
    onEditorFocusOut(ev?: FocusEvent): void;
    /** The composer's text, untrimmed, which is what the character counter measures. */
    rawText(): string;
    /** @returns {string} The document serialized to an XEP-0393 styled body. */
    getInputText(): string;
    clearInput(): void;
    /** @param {boolean} disabled */
    setInputDisabled(disabled: boolean): void;
    focusInput(): void;
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
     * Mirrors the base handler, but hands the character counter the composer's text: it
     * would otherwise read `.value` off the event target, which a contenteditable lacks.
     * @param {KeyboardEvent} ev
     */
    onKeyUp(ev: KeyboardEvent): void;
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev: KeyboardEvent): any;
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
     * @param {SubmitEvent|KeyboardEvent} ev
     */
    onFormSubmitted(ev: SubmitEvent | KeyboardEvent): Promise<void>;
}
export type EmojiDropdown = import("shared/chat/emoji-dropdown.js").default;
import { CustomElement } from 'shared/components/element.js';
import { TypeaheadController } from 'shared/rich-composer/typeahead.js';
//# sourceMappingURL=message-form.d.ts.map