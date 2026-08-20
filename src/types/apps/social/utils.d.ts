/**
 * A JID shortened for display: an over-long localpart is elided in the middle,
 * keeping its head, its tail and the domain, which is what says *where* an author
 * lives. Short JIDs, which is to say every human-chosen one, are returned untouched.
 *
 * This should only be used for display purposes.
 * @param {string} [jid]
 * @returns {string}
 */
export function shortenJID(jid?: string): string;
/**
 * Whether a post's display name carries no more information than its author's
 * JID, which is the case for an author that has no human name to show.
 *
 * A name that is only the JID's localpart counts as one, but *only* for a
 * localpart long enough to be machine-generated.
 * @param {string} [name]
 * @param {string} [jid]
 * @returns {boolean}
 */
export function isJIDName(name?: string, jid?: string): boolean;
//# sourceMappingURL=utils.d.ts.map