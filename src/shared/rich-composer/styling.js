/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Lexical transformer sets for XEP-0393 Message Styling, the format chat sends on the
 * wire.
 *
 * XEP-0393 belongs to the *chat* family of markup (as used by Slack and WhatsApp) rather
 * than the CommonMark lineage, so a single `*` means **bold**, not italic:
 *
 *   XEP-0393    `*bold*`  `_italic_`  `~strike~`  `` `code` ``  `> quote`
 *   CommonMark  `**bold**`  `_italic_`  `~~strike~~`  `` `code` ``  `> quote`
 *
 * Several of Lexical's built-ins already agree with XEP-0393, so only bold and strikethrough
 * need defining here.
 *
 * Like the rest of the editor layer this module pulls in Lexical, so it must only ever be
 * reached through a composer's dynamic `import()`.
 */
import { CODE, INLINE_CODE, ITALIC_UNDERSCORE, QUOTE } from '@lexical/markdown';

/** `*bold*` (CommonMark would read this as italic). */
export const BOLD_SINGLE_STAR = { format: ['bold'], tag: '*', type: 'text-format' };

/** `~strike~` (CommonMark requires a doubled `~~`). */
export const STRIKE_SINGLE_TILDE = { format: ['strikethrough'], tag: '~', type: 'text-format' };

/**
 * The full XEP-0393 set, for chat's input *and* output.
 *
 * Consumers must register the nodes these need: `QuoteNode` (from `@lexical/rich-text`)
 * and `CodeNode` (from `@lexical/code`).
 */
export const STYLING_TRANSFORMERS = [
    CODE, // '```' preformatted block (XEP-0393 § 5.1.2); must precede the span directives
    QUOTE, // '>' quote, an element transformer
    BOLD_SINGLE_STAR,
    ITALIC_UNDERSCORE,
    STRIKE_SINGLE_TILDE,
    INLINE_CODE,
];

// Lexical escapes markdown-special characters when serializing, so a URL like
// `.../Ender's_Game` comes out as `.../Ender's\_Game`. XEP-0393 defines no escape syntax
// at all, so that backslash is not an escape on the wire: it is a literal character the
// recipient would render. Undo it.
const MARKDOWN_ESCAPE = /\\([\\*_~`>])/g;

/**
 * Strip the backslash escapes Lexical adds, which XEP-0393 has no notion of.
 * @param {string} text
 * @returns {string}
 */
export function stripMarkdownEscapes(text) {
    return text.replace(MARKDOWN_ESCAPE, '$1');
}

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
export function withStylingShortcuts(transformers) {
    const conflicting = new Set(['*', '~']);

    // Longer tags first: '**' must be tried before '*', else it matches as an empty bold.
    const kept = transformers.filter((t) => !(t.type === 'text-format' && conflicting.has(t.tag)));
    return [...kept, BOLD_SINGLE_STAR, STRIKE_SINGLE_TILDE];
}
