import { converse } from '@converse/headless';
import { __ } from 'i18n';

const { dayjs } = converse.env;

// dayjs has no localized long date *without* a year, so the day-and-month
// form is produced with the platform's Intl API instead. Formatters are
// cached per locale, since constructing an Intl.DateTimeFormat is expensive.
const month_day_formatters = {};

/**
 * Render a date as a localized day and month without a year, following the
 * active dayjs locale, e.g. "3 July" (en-GB), "July 3" (en-US), "7月3日" (ja).
 * @param {import('dayjs').Dayjs} date
 * @returns {string}
 */
function formatMonthAndDay(date) {
    const locale = dayjs.locale();
    let formatter = month_day_formatters[locale];
    if (!formatter) {
        formatter = month_day_formatters[locale] = new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'long',
        });
    }
    return formatter.format(date.toDate());
}

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
export function getRelativeTime(time) {
    const now = dayjs();
    const then = dayjs(time);
    const seconds = now.diff(then, 'second');
    if (seconds < 60) return __('now');
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;

    // `LT` renders the time in the locale's own 12h/24h convention.
    const time_str = then.format('LT');
    if (now.subtract(1, 'day').isSame(then, 'day')) {
        return __('%1$s at %2$s', __('Yesterday'), time_str);
    }
    if (now.diff(then, 'week') < 1) {
        // Translators: Joins a date and a time into one label, e.g. "Yesterday at 04:38"
        // or "3 July at 04:38". %1$s is the date (the word "Yesterday", a weekday, a day
        // and month, or a full date) and %2$s is the time. Change the word "at" and the
        // order of the two parts to suit your language.
        return __('%1$s at %2$s', then.format('dddd'), time_str);
    }
    if (now.diff(then, 'year') < 1) {
        return __('%1$s at %2$s', formatMonthAndDay(then), time_str);
    }
    return __('%1$s at %2$s', then.format('LL'), time_str); // `LL` is the locale's long date (with year)
}

/**
 * Sorts items newest-first by their ISO-8601 `time` (published/updated).
 * @param {import('@converse/skeletor').Model} a
 * @param {import('@converse/skeletor').Model} b
 */
export function byTimeDesc(a, b) {
    return (b.get('time') ?? '').localeCompare(a.get('time') ?? '');
}
