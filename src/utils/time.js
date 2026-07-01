import { converse } from '@converse/headless';
import { __ } from 'i18n';

const { dayjs } = converse.env;

/**
 * Format a timestamp to show a relative time ("now", "5m", "18h")
 * while it's less than 24 hours old, then the localized calendar
 * date once it's older.
 * @param {string|number|Date} time - anything dayjs can parse
 * @returns {string}
 */
export function getRelativeTime(time) {
    const seconds = dayjs().diff(time, 'second');
    if (seconds < 60) return __('now');
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return dayjs(time).format('ll');
}

/**
 * Sorts items newest-first by their ISO-8601 `time` (published/updated).
 * @param {import('@converse/skeletor').Model} a
 * @param {import('@converse/skeletor').Model} b
 */
export function byTimeDesc(a, b) {
    return (b.get('time') ?? '').localeCompare(a.get('time') ?? '');
}
