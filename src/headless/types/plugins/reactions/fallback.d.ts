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
export function buildReactionFallbackBody(text: string, emojis: string[]): string;
export const REACTION_FALLBACK_QUOTE_LENGTH: 80;
//# sourceMappingURL=fallback.d.ts.map