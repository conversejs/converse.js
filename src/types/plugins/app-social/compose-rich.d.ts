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
    render(): import("lit-html").TemplateResult<1>;
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