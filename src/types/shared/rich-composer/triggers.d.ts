/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Caret-typeahead trigger patterns, shared by the rich composers.
 *
 * Deliberately free of any Lexical import: composers reference these eagerly when
 * declaring their typeahead sources, and pulling the editor module in at that point
 * would defeat its code-splitting (see {@link ./editor.js}).
 *
 * Each pattern matches the text immediately before a collapsed caret, and captures
 * the typed query in group 1.
 */
export const EMOJI_TRIGGER: RegExp;
export const MENTION_TRIGGER: RegExp;
//# sourceMappingURL=triggers.d.ts.map