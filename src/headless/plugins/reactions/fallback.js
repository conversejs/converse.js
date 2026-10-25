// How many code points of the reacted-to message to quote in the fallback body.
// Kept in sync with the XEP-0461 reply fallback (model-with-messages.js), which
// matches the reply-context preview length.
export const REACTION_FALLBACK_QUOTE_LENGTH = 80;

/**
 * Build the human-readable body that doubles as the legacy-OMEMO fallback for a
 * reaction: a XEP-0393 `>`-quote of the reacted-to text (collapsed to a single
 * line and truncated to the first {@link REACTION_FALLBACK_QUOTE_LENGTH} code
 * points + an ellipsis) followed by the emoji(s), e.g.:
 *
 *     > But soft, what light through yonder…
 *     👍
 *
 * so a legacy recipient — who can't carry the structured `<reactions>` — sees
 * both what is being reacted to and with what. The quote is omitted when the
 * reacted-to message has no displayable text (e.g. a media-only message); the
 * whole thing is empty for a retraction (no emojis).
 *
 * @param {string} text - the reacted-to message's text
 * @param {string[]} emojis - the reaction emoji(s)
 * @returns {string}
 */
export function buildReactionFallbackBody(text, emojis) {
    const reaction = emojis.join('');
    const snippet = (text ?? '').replace(/\s+/g, ' ').trim();
    if (!snippet || !reaction) return reaction;

    // Truncate by code points (XEP-0426), not UTF-16 units, so multi-byte
    // characters aren't split.
    const chars = [...snippet];
    const quote =
        chars.length > REACTION_FALLBACK_QUOTE_LENGTH
            ? chars.slice(0, REACTION_FALLBACK_QUOTE_LENGTH).join('') + '…'
            : snippet;
    return `> ${quote}\n${reaction}`;
}
