/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * A tiny, self-contained single-emoji test used to classify a comment as a
 * reaction (XEP-0277 § Comments convention: a comment whose text is exactly one
 * emoji is a reaction to its target; `♥` is the default "like"). Kept standalone
 * (no plugin/model imports) so `post-comment.js` and the count helpers can use it
 * without pulling in the heavier `utils.js` import graph, and so detection works
 * at parse time regardless of whether the emoji dataset has loaded yet.
 */
import { LIKE_MARKER } from '../constants.js';

/** @type {Intl.Segmenter|undefined} lazily created grapheme segmenter */
let grapheme_segmenter;

/**
 * The grapheme clusters of a string. Emoji built from several code points (skin
 * tones, ZWJ sequences like 👨‍👩‍👧‍👦) are a single grapheme, so counting
 * graphemes (not code points) is what tells "one emoji" from "several".
 * @param {string} text
 * @returns {string[]}
 */
function graphemes(text) {
    grapheme_segmenter ||= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(grapheme_segmenter.segment(text), (s) => s.segment);
}

/**
 * Whether `text` is exactly one emoji: a single grapheme cluster that carries the
 * Unicode Extended_Pictographic property. The legacy heart marker (`♥`, U+2665)
 * is always accepted so a "like" is recognised as a reaction regardless of the
 * property lookup. Deliberately stricter than the emoji plugin's `isOnlyEmojis`
 * (which accepts up to three emoji): a reaction is one emoji.
 * @param {string} [text]
 * @returns {boolean}
 */
export function isSingleEmoji(text) {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return false;
    if (trimmed === LIKE_MARKER) return true;
    if (graphemes(trimmed).length !== 1) return false;
    return (/\p{Extended_Pictographic}/u).test(trimmed);
}
