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

// An emoji-shortname trigger. A colon `:` that starts a token followed by at least one
// shortname character. A closing `:` ends the token.
export const EMOJI_TRIGGER = /(?:^|\s):([-+\w]+)$/;

// A mention trigger. An `@` that starts a token, followed by zero or more name/JID
// characters (a bare `@` lists everyone). `@` and `.` are in the charset so a full
// JID can be typed; `:` is not, so this and EMOJI_TRIGGER are mutually exclusive.
export const MENTION_TRIGGER = /(?:^|\s)@([\w.@-]*)$/;
