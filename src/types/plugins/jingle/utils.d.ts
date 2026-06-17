/**
 * The peer's name for the call UI. The roster contact resolves asynchronously,
 * so we fall back to the nickname and then the JID node while it's still null.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function getCallName(call: import("@converse/headless").Call): string;
/**
 * @param {number} ms
 * @returns {string} elapsed time as `m:ss`
 */
export function formatDuration(ms: number): string;
/**
 * Human-readable reason for a call that didn't connect (or didn't end cleanly).
 * @param {string} reason - one of {@link ENDED_REASONS}
 * @returns {string}
 */
export function reasonText(reason: string): string;
/**
 * The summary line shown in the call card once it's over.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function endedSummary(call: import("@converse/headless").Call): string;
/**
 * Write a history row into the peer's chat log when a call ends.
 * @param {import('@converse/headless').Call} call
 */
export function writeCallHistory(call: import("@converse/headless").Call): void;
//# sourceMappingURL=utils.d.ts.map