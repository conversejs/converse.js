/**
 * Attach a Lexical editor configured for chat messages.
 * @param {HTMLElement} rootEl - A `contenteditable` host element.
 * @param {object} [opts]
 * @param {() => void} [opts.onChange] - Called after each edit.
 * @returns {import('shared/rich-composer/types').RichEditor}
 */
export function createChatEditor(rootEl: HTMLElement, { onChange }?: {
    onChange?: () => void;
}): import("shared/rich-composer/types").RichEditor;
//# sourceMappingURL=lexical-editor.d.ts.map