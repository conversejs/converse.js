/**
 * Runs under Node, not a browser, to pin that the XEP-0202 logic carries no
 * hidden dependency on the DOM. A TUI or any other non-browser client depends
 * on that, so it's asserted rather than assumed.
 */
import { describe, expect, it, vi } from 'vitest';
import '../../../shims/node-dom.js';
import {
    formatRemoteTime,
    formatTZO,
    getLocalTZOMinutes,
    getRemoteHour,
    getTimezoneDiffMinutes,
    isOffHours,
    parseTZO,
} from '../utils.js';

const NOON_UTC = new Date('2026-03-16T12:00:00Z');

describe('The XEP-0202 timezone helpers, under Node', () => {
    it('parses and formats offsets, round-tripping', () => {
        expect(parseTZO('+05:30')).toBe(330);
        expect(parseTZO('-05:45')).toBe(-345);
        expect(parseTZO('invalid')).toBe(0);

        expect(formatTZO(330)).toBe('+05:30');
        expect(formatTZO(-345)).toBe('-05:45');
        expect(formatTZO(0)).toBe('+00:00');

        for (const tzo of ['+00:00', '+05:30', '-08:00', '-05:45', '+14:00', '-12:00']) {
            expect(formatTZO(parseTZO(tzo))).toBe(tzo);
        }
    });

    it('works out the remote hour and clock time', () => {
        expect(getRemoteHour(NOON_UTC, '+00:00')).toBe(12);
        expect(getRemoteHour(NOON_UTC, '+05:30')).toBe(17);
        expect(getRemoteHour(NOON_UTC, '-08:00')).toBe(4);

        // With an explicit locale, so that the assertion doesn't depend on the
        // locale of whoever is running the suite.
        expect(formatRemoteTime(NOON_UTC, '+05:30', 'en-GB')).toBe('17:30');
        expect(formatRemoteTime(NOON_UTC, '-08:00', 'en-GB')).toBe('04:00');
        expect(formatRemoteTime(NOON_UTC, '+05:30', 'en-US')).toMatch(/^5:30\s?PM$/);

        // @converse/headless on its own has no locale of its own to consult,
        // and must fall back to the runtime's rather than fail.
        expect(formatRemoteTime(NOON_UTC, '+05:30')).toBeTruthy();
    });

    it('identifies off-hours across and within a day', () => {
        expect(isOffHours(23, 22, 7)).toBe(true);
        expect(isOffHours(3, 22, 7)).toBe(true);
        expect(isOffHours(7, 22, 7)).toBe(false);
        expect(isOffHours(12, 22, 7)).toBe(false);
        // A window that doesn't span midnight.
        expect(isOffHours(17, 17, 18)).toBe(true);
        expect(isOffHours(18, 17, 18)).toBe(false);
    });

    it('compares timezones in minutes, keeping the sub-hour zones', () => {
        vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-300); // UTC+05:00
        expect(getLocalTZOMinutes()).toBe(300);

        expect(getTimezoneDiffMinutes('+05:00')).toBe(0);
        expect(getTimezoneDiffMinutes('+05:30')).toBe(30);
        expect(getTimezoneDiffMinutes('+05:45')).toBe(45);
        expect(getTimezoneDiffMinutes('-08:00')).toBe(780);
    });
});

describe('A XEP-0202 result stanza, under Node', () => {
    it('is readable through the Node selector shim', () => {
        const iq = new DOMParser().parseFromString(
            `<iq type="result" xmlns="jabber:client">
                <time xmlns="urn:xmpp:time"><tzo>-06:00</tzo><utc>2026-03-16T12:00:00Z</utc></time>
            </iq>`,
            'text/xml',
        ).documentElement;

        // The same `:scope >` queries api.time.get uses.
        const time_el = iq.querySelector(':scope > time');
        expect(time_el.querySelector(':scope > tzo').textContent).toBe('-06:00');
        expect(time_el.querySelector(':scope > utc').textContent).toBe('2026-03-16T12:00:00Z');
        expect(new Date(time_el.querySelector(':scope > utc').textContent)).toEqual(NOON_UTC);
    });
});
