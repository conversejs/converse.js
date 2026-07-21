/**
 * Build a typing-shortcut set that accepts XEP-0393's single-character markers *on top of*
 * a consumer's own set, so every composer shares one typing experience regardless of what
 * it serializes to.
 *
 * Callers must drop any transformer that claims a conflicting single `*` (CommonMark's
 * ITALIC_STAR), otherwise the two fight over the same tag. Doubled tags are kept and
 * ordered first, so typing `**bold**` still works for anyone used to CommonMark.
 *
 * @param {Array<any>} transformers - The consumer's own set (usually its output set).
 * @returns {Array<any>} A set suitable for `input_transformers`.
 */
export function withStylingShortcuts(transformers: Array<any>): Array<any>;
export namespace BOLD_SINGLE_STAR {
    let format: string[];
    let tag: string;
    let type: string;
}
export namespace STRIKE_SINGLE_TILDE {
    let format_1: string[];
    export { format_1 as format };
    let tag_1: string;
    export { tag_1 as tag };
    let type_1: string;
    export { type_1 as type };
}
/**
 * The full XEP-0393 set, for chat's input *and* output.
 *
 * Consumers must register the nodes these need: `QuoteNode` (from `@lexical/rich-text`)
 * and `CodeNode` (from `@lexical/code`).
 */
export const STYLING_TRANSFORMERS: (import("@lexical/markdown").ElementTransformer | import("@lexical/markdown").MultilineElementTransformer | Readonly<{
    format: readonly import("lexical").TextFormatType[];
    tag: string;
    intraword?: boolean;
    type: "text-format";
}> | {
    format: string[];
    tag: string;
    type: string;
})[];
//# sourceMappingURL=styling.d.ts.map