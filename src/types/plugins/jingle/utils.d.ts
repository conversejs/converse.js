/**
 * The peer's name for the call UI. The roster contact resolves asynchronously,
 * so we fall back to the nickname and then the JID node while it's still null.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function getCallName(call: import("@converse/headless").Call): string;
/**
 * The summary line shown in the call card once it's over.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function endedSummary(call: import("@converse/headless").Call): string;
//# sourceMappingURL=utils.d.ts.map