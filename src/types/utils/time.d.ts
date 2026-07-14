/**
 * Format a timestamp as a localized relative time:
 * - under a minute: "now"
 * - under an hour: "5m"
 * - under a day: "18h"
 * - the day before: "Yesterday" and time, e.g. "Yesterday at 04:38"
 * - under a week: weekday and time, e.g. "Tuesday at 04:38"
 * - under a year: day, month and time, e.g. "3 July at 04:38"
 * - a year or older: day, month, year and time, e.g. "3 July 2024 at 04:38"
 *
 * The weekday, month name, year and time are all rendered in the active
 * locale, and the "at" connector is translatable, so translators can also
 * reorder the date and time. dayjs has no localized long date without a year,
 * so the "under a year" branch uses the platform's Intl API (see
 * {@link formatMonthAndDay}) to get the correct day/month order per locale.
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