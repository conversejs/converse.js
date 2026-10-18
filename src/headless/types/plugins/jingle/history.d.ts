/**
 * @param {number} ms
 * @returns {string} elapsed time as `m:ss`
 */
export function formatDuration(ms: number): string;
/**
 * @param {import('./model.js').default} call
 * @returns {string|null} how long the call was connected, as `m:ss`, or null if it never was
 */
export function callDuration(call: import("./model.js").default): string | null;
/**
 * Why a call didn't connect (or didn't end cleanly).
 * @param {string} reason - one of {@link ENDED_REASONS}
 * @returns {string}
 */
export function reasonText(reason: string): string;
/** @param {import('./model.js').default} call */
export function writeCallHistory(call: import("./model.js").default): Promise<void>;
/**
 * A call we never rang for, because it reached us after the caller gave up.
 * @param {string} jid - the caller's bare JID
 * @param {string} time - ISO 8601, when the call was made
 */
export function writeMissedCall(jid: string, time: string): Promise<void>;
//# sourceMappingURL=history.d.ts.map