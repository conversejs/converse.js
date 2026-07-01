/**
 * Format a timestamp to show a relative time ("now", "5m", "18h")
 * while it's less than 24 hours old, then the localized calendar
 * date once it's older.
 * @param {string|number|Date} time - anything dayjs can parse
 * @returns {string}
 */
export function getRelativeTime(time: string | number | Date): string;
/**
 * Sorts items newest-first by their ISO-8601 `time` (published/updated).
 * @param {import('@converse/skeletor').Model} a
 * @param {import('@converse/skeletor').Model} b
 */
export function byTimeDesc(a: import("@converse/skeletor").Model, b: import("@converse/skeletor").Model): any;
//# sourceMappingURL=time.d.ts.map