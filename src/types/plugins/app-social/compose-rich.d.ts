export default class SocialComposeRich extends CustomElement {
    static get properties(): {
        model: {
            type: typeof PubSubFeed;
        };
        _publishing: {
            type: BooleanConstructor;
            state: boolean;
        };
        _uploading: {
            type: BooleanConstructor;
            state: boolean;
        };
        _empty: {
            type: BooleanConstructor;
            state: boolean;
        };
        _attachments: {
            type: ArrayConstructor;
            state: boolean;
        };
        _emoji_suggestions: {
            type: ArrayConstructor;
            state: boolean;
        };
        _emoji_index: {
            type: NumberConstructor;
            state: boolean;
        };
        _emoji_pos: {
            type: ObjectConstructor;
            state: boolean;
        };
    };
    _publishing: boolean;
    _uploading: boolean;
    _empty: boolean;
    /** @type {Array<{ href: string, type?: string, title?: string }>} */
    _attachments: Array<{
        href: string;
        type?: string;
        title?: string;
    }>;
    /** @type {import('./types').EditorHandle|null} */
    _handle: import("./types").EditorHandle | null;
    /** @type {Promise<import('./types').EditorHandle>|null} */
    _init: Promise<import("./types").EditorHandle> | null;
    /** @type {Array<{ sn: string, glyph: string, url?: string }>} */
    _emoji_suggestions: Array<{
        sn: string;
        glyph: string;
        url?: string;
    }>;
    _emoji_index: number;
    /** @type {{ left: number, top: number }} */
    _emoji_pos: {
        left: number;
        top: number;
    };
    _emoji_query: string;
    /** @type {string|null} */
    _emoji_dismissed_query: string | null;
    _menu_closed_by_blur: boolean;
    _pointer_down: boolean;
    render(): import("lit-html").TemplateResult<1>;
    _onDocPointerDown: () => void;
    _pointer_down_timer: number;
    /**
     * Lazily load Lexical and attach it to the contenteditable host, once. The
     * dynamic import keeps the (sizeable) editor out of the core bundle: the chunk
     * is fetched only when the user first focuses the composer.
     * @returns {Promise<import('./types').EditorHandle>}
     */
    ensureEditor(): Promise<import("./types").EditorHandle>;
    /** Reflect emptiness (placeholder + Post enabled) only when it actually flips. */
    onChange(): void;
    /**
     * Recompute the inline emoji autocomplete after each edit: if the caret sits on
     * a `:query` trigger, show the matching shortnames; otherwise close the menu.
     */
    updateEmojiTypeahead(): Promise<void>;
    /** Close the emoji autocomplete menu. */
    closeEmojiTypeahead(): void;
    /** The emoji menu's inline position, as a single CSS declaration string. */
    get emojiMenuStyle(): string;
    /**
     * The caret's position relative to the `.social-rich` container, so the menu can
     * be anchored just below the current line. Falls back to the editable's box when
     * a caret rect is unavailable.
     * @returns {{ left: number, top: number }}
     */
    caretPosition(): {
        left: number;
        top: number;
    };
    /**
     * Keyboard navigation for the emoji menu. Intercepts arrows / Enter / Tab / Escape
     * only while the menu is open, keeping them away from Lexical (which handles the
     * same keys on the same element).
     * @param {KeyboardEvent} ev
     */
    onEditorKeyDown(ev: KeyboardEvent): void;
    /**
     * Close the emoji menu whenever focus leaves the editor.
     * @param {FocusEvent} [ev]
     */
    onEditorFocusOut(ev?: FocusEvent): void;
    /**
     * Move the active suggestion, wrapping around the ends.
     * @param {number} delta
     */
    moveEmojiSelection(delta: number): void;
    /**
     * The emoji picker dropdown was closed (Escape, outside click, or a pick):
     * hand focus back to the editor, with the caret where it was. Mirrors chat,
     * where the message textarea is refocused when the picker closes.
     */
    onPickerClosed(): void;
    /**
     * Insert the chosen suggestion's glyph in place of the `:query` trigger.
     * @param {number} index
     */
    chooseEmoji(index: number): void;
    /**
     * @param {import('lexical').TextFormatType} type - the toolbar uses
     *      'bold' | 'italic' | 'strikethrough' | 'code'
     */
    onFormat(type: import("lexical").TextFormatType): Promise<void>;
    /**
     * Insert a picked emoji (already resolved to a unicode glyph / text) at the cursor.
     * @param {string} text
     */
    onEmoji(text: string): Promise<void>;
    /**
     * Upload the chosen file(s) via XEP-0363 and add each as a pending attachment,
     * published later as a media enclosure. Failures are toasted per file.
     * @param {FileList|File[]} files
     */
    onAttach(files: FileList | File[]): Promise<void>;
    /**
     * Drop a pending attachment before publishing.
     * @param {number} index
     */
    removeAttachment(index: number): void;
    /**
     * Paste files (e.g. a screenshot) straight into the upload flow, exactly like a
     * paperclip pick. A text/rich paste carries no files, so it falls through to
     * Lexical unchanged.
     * @param {ClipboardEvent} ev
     */
    onPaste(ev: ClipboardEvent): void;
    /**
     * Normalise Lexical's HTML export to a well-formed XHTML `<div>` fragment: run
     * it through DOMPurify (stripping the editor-only `class`/`style` hooks Lexical
     * stamps on for styling, so they never reach the wire), then re-serialize via
     * XMLSerializer so the result is valid XML (self-closed voids, escaped entities,
     * namespaced) and can be injected verbatim into the publish stanza (which is
     * XML-parsed).
     * @param {string} html
     * @returns {string}
     */
    htmlToXhtml(html: string): string;
    /**
     * @param {Event} [ev]
     */
    onSubmit(ev?: Event): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
import { PubSubFeed } from '@converse/headless';
//# sourceMappingURL=compose-rich.d.ts.map