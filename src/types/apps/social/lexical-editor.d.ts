/**
 * Attach a Lexical rich-text editor configured for Social posts.
 * @param {HTMLElement} rootEl - A `contenteditable` host element.
 * @param {object} [opts]
 * @param {() => void} [opts.onChange] - Called after each edit (e.g. to toggle a
 *      disabled Post button). Kept optional so the caller can avoid per-keystroke
 *      re-renders.
 * @returns {import('./types.ts').LexicalEditor}
 */
export function createSocialEditor(rootEl: HTMLElement, { onChange }?: {
    onChange?: () => void;
}): import("./types.ts").LexicalEditor;
//# sourceMappingURL=lexical-editor.d.ts.map