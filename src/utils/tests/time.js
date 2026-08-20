import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import converse from '../../../dist/converse.js';

const { dayjs } = converse.env;
const { getRelativeTime } = converse.env.utils;

describe('The getRelativeTime function', () => {
    // Pin "now" to Wednesday 2026-07-15 at noon: mid-month, mid-year and midday,
    // so every tier and boundary is exercised without any calendar edge effects.
    const now = new Date('2026-07-15T12:00:00');

    beforeEach(() => {
        dayjs.locale('en'); // the assertions below expect English formatting
        vi.useFakeTimers();
        vi.setSystemTime(now);
    });

    afterEach(() => vi.useRealTimers());

    it('shows "now" for timestamps under a minute old', () => {
        expect(getRelativeTime(now)).toBe('now');
        expect(getRelativeTime(dayjs(now).subtract(59, 'second'))).toBe('now');
    });

    it('shows whole minutes for timestamps under an hour old', () => {
        expect(getRelativeTime(dayjs(now).subtract(1, 'minute'))).toBe('1m');
        expect(getRelativeTime(dayjs(now).subtract(59, 'minute'))).toBe('59m');
    });

    it('shows whole hours for timestamps under a day old', () => {
        expect(getRelativeTime(dayjs(now).subtract(1, 'hour'))).toBe('1h');
        expect(getRelativeTime(dayjs(now).subtract(23, 'hour'))).toBe('23h');
    });

    it('keeps showing hours for a previous-day timestamp that is still under 24h old', () => {
        // 18:00 the day before is "yesterday" on the calendar, but only 18h have
        // elapsed, so the hours form takes precedence over "Yesterday".
        expect(getRelativeTime(dayjs(now).subtract(18, 'hour'))).toBe('18h');
    });

    it('shows "Yesterday" and the time once a previous-day timestamp is over 24h old', () => {
        const then = dayjs('2026-07-14T04:38:00'); // Tuesday, ~31h before Wednesday noon
        expect(getRelativeTime(then)).toBe(`Yesterday at ${then.format('LT')}`);
        expect(getRelativeTime(then)).toBe('Yesterday at 4:38 AM');
    });

    it('shows the weekday and time for older timestamps within the past week', () => {
        const then = dayjs('2026-07-12T09:15:00'); // Sunday, 3 days earlier
        expect(getRelativeTime(then)).toBe(`${then.format('dddd')} at ${then.format('LT')}`);
        expect(getRelativeTime(then)).toBe('Sunday at 9:15 AM');
    });

    it('shows a localized day and month without a year for timestamps older than a week', () => {
        const then = dayjs('2026-03-03T04:38:00'); // ~4 months earlier
        // The day/month part comes from Intl so its order follows the locale.
        const month_day = new Intl.DateTimeFormat(dayjs.locale(), { day: 'numeric', month: 'long' }).format(
            then.toDate(),
        );
        expect(getRelativeTime(then)).toBe(`${month_day} at ${then.format('LT')}`);
        expect(getRelativeTime(then)).toBe('March 3 at 4:38 AM'); // en orders month before day
    });

    it('includes the year for timestamps a year or more old', () => {
        const then = dayjs('2024-07-03T04:38:00'); // 2 years earlier
        expect(getRelativeTime(then)).toBe(`${then.format('LL')} at ${then.format('LT')}`);
        expect(getRelativeTime(then)).toBe('July 3, 2024 at 4:38 AM');
    });
});
