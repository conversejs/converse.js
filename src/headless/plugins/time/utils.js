import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import u from '../../utils/index.js';

const { Strophe, stx } = converse.env;

/**
 * Responds to incoming time requests per XEP-0202
 * @param {Element} iq - The incoming IQ stanza
 * @returns {boolean}
 */
function handleTimeRequest(iq) {
    const from = iq.getAttribute('from');
    const id = iq.getAttribute('id');

    const now = new Date();
    // Get timezone offset in ±HH:MM format
    const tzo_minutes = now.getTimezoneOffset();
    const tzo_sign = tzo_minutes <= 0 ? '+' : '-';
    const tzo_hours = String(Math.floor(Math.abs(tzo_minutes) / 60)).padStart(2, '0');
    const tzo_mins = String(Math.abs(tzo_minutes) % 60).padStart(2, '0');
    const tzo = `${tzo_sign}${tzo_hours}:${tzo_mins}`;

    // Get UTC time in ISO 8601 format (without milliseconds)
    const utc = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

    const response = stx`
        <iq type="result" to="${from}" id="${id}" xmlns="jabber:client">
            <time xmlns="${Strophe.NS.TIME}">
                <tzo>${tzo}</tzo>
                <utc>${utc}</utc>
            </time>
        </iq>`;

    api.sendIQ(response);
    return true;
}

/**
 * Registers the XEP-0202 time handler and advertises support via disco
 */
export function registerTimeHandler() {
    const connection = api.connection.get();
    if (connection.disco) {
        api.disco.own.features.add(Strophe.NS.TIME);
    }
    return connection.addHandler(handleTimeRequest, Strophe.NS.TIME, 'iq', 'get');
}

/**
 * Parses timezone offset string (±HH:MM) to minutes
 * @param {string} tzo - Timezone offset string like "+05:30" or "-08:00"
 * @returns {number} Offset in minutes
 */
export function parseTZO(tzo) {
    const match = tzo.match(/^([+-])(\d{2}):(\d{2})$/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const mins = parseInt(match[3], 10);
    return sign * (hours * 60 + mins);
}

/**
 * Checks if the given hour falls within "off-hours" (e.g., nighttime)
 * @param {number} hour - Hour in 24h format (0-23)
 * @param {number} warning_start - Start hour of warning period (default 22)
 * @param {number} warning_end - End hour of warning period (default 7)
 * @returns {boolean}
 */
export function isOffHours(hour, warning_start = 22, warning_end = 7) {
    if (warning_start > warning_end) {
        // Range spans midnight (e.g., 22:00 - 07:00)
        return hour >= warning_start || hour < warning_end;
    } else {
        // Range within same day
        return hour >= warning_start && hour < warning_end;
    }
}

/**
 * Gets the current hour in the remote entity's timezone
 * @param {Date} now - The current time (e.g., new Date())
 * @param {string} tzo - Timezone offset string like "+05:30"
 * @returns {number} Hour in remote timezone (0-23)
 */
export function getRemoteHour(now, tzo) {
    const offset_mins = parseTZO(tzo);
    const remote_time = new Date(now.getTime() + offset_mins * 60 * 1000);
    return remote_time.getUTCHours();
}

/**
 * Formats the current time in a remote timezone as HH:MM
 * @param {Date} now - The current time (e.g., new Date())
 * @param {string} tzo - Timezone offset string like "+05:30"
 * @returns {string} Time string in HH:MM format
 */
export function formatRemoteTime(now, tzo) {
    const offset_mins = parseTZO(tzo);
    const remote_time = new Date(now.getTime() + offset_mins * 60 * 1000);
    const hours = String(remote_time.getUTCHours()).padStart(2, '0');
    const minutes = String(remote_time.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Gets the local (browser) timezone offset in minutes
 * @returns {number} Offset in minutes (positive = ahead of UTC)
 */
export function getLocalTZOMinutes() {
    // getTimezoneOffset returns minutes behind UTC (negative for ahead)
    // We invert it to match our convention (positive = ahead of UTC)
    return -new Date().getTimezoneOffset();
}

/**
 * Calculates the absolute difference in hours between two timezones
 * @param {string} remote_tzo - Remote timezone offset string like "+05:30"
 * @returns {number} Absolute difference in hours
 */
export function getTimezoneDiffHours(remote_tzo) {
    const remote_mins = parseTZO(remote_tzo);
    const local_mins = getLocalTZOMinutes();
    return Math.abs(remote_mins - local_mins) / 60;
}

// Export utility functions for use by other plugins
Object.assign(u, { time: { parseTZO, isOffHours, getRemoteHour, formatRemoteTime, getLocalTZOMinutes, getTimezoneDiffHours } });
