/**
 * Advertises XEP-0202 support in our own disco#info, which XEP-0202 § 3
 * requires of any entity that answers time queries.
 *
 * Both sharing modes advertise: under 'presence' we do support the protocol,
 * and who gets an answer is a matter of authorization rather than support.
 * Nothing is advertised when sharing is off, since we then answer nobody.
 */
export function addClientFeatures(): void;
/**
 * Registers the XEP-0202 time handler. Strophe drops its handlers when the
 * connection is re-established, so this runs again on every reconnection.
 */
export function registerTimeHandler(): any;
/**
 * Formats an offset in minutes as the ±HH:MM string XEP-0202 uses.
 * The inverse of {@link parseTZO}.
 * @param {number} minutes - Offset in minutes (positive = ahead of UTC)
 * @returns {string} Timezone offset string like "+05:30"
 */
export function formatTZO(minutes: number): string;
/**
 * Canonicalises an offset that came off the wire, or rejects it.
 *
 * XEP-0202 § 4 defers to XEP-0082, whose TZD is either "Z" or ±HH:MM, so a peer
 * in UTC may legitimately answer "Z". Anything else we can't read, and taking
 * it anyway would be worse than having no offset at all: {@link parseTZO}
 * answers 0 for what it can't parse, which would put the contact in our own
 * timezone and warn (or fail to warn) on hours that aren't theirs.
 * @param {string} tzo - An offset as received, e.g. "+05:30" or "Z"
 * @returns {string|null} The offset as ±HH:MM, or null if it isn't one
 */
export function normalizeTZO(tzo: string): string | null;
/**
 * Parses timezone offset string (±HH:MM) to minutes
 * @param {string} tzo - Timezone offset string like "+05:30" or "-08:00"
 * @returns {number} Offset in minutes
 */
export function parseTZO(tzo: string): number;
/**
 * Checks if the given hour falls within "off-hours" (e.g., nighttime)
 * @param {number} hour - Hour in 24h format (0-23)
 * @param {number} warning_start - Start hour of warning period (default 22)
 * @param {number} warning_end - End hour of warning period (default 7)
 * @returns {boolean}
 */
export function isOffHours(hour: number, warning_start?: number, warning_end?: number): boolean;
/**
 * Gets the current hour in the remote entity's timezone
 * @param {Date} now - The current time (e.g., new Date())
 * @param {string} tzo - Timezone offset string like "+05:30"
 * @returns {number} Hour in remote timezone (0-23)
 */
export function getRemoteHour(now: Date, tzo: string): number;
/**
 * Formats the current time in a remote timezone the way the user's locale
 * writes times, so that a 12-hour locale gets "11:14 PM" rather than "23:14".
 * @param {Date} now - The current time (e.g., new Date())
 * @param {string} tzo - Timezone offset string like "+05:30"
 * @param {string} [locale] - A BCP 47 tag. Defaults to the UI locale.
 * @returns {string} The remote time, formatted for display
 */
export function formatRemoteTime(now: Date, tzo: string, locale?: string): string;
/**
 * Gets the local (browser) timezone offset in minutes
 * @returns {number} Offset in minutes (positive = ahead of UTC)
 */
export function getLocalTZOMinutes(): number;
/**
 * Calculates the absolute difference between a remote timezone and ours.
 *
 * Minutes rather than hours, because plenty of timezones are offset by a
 * fraction of an hour (+05:30 in India, +05:45 in Nepal, -03:30 in
 * Newfoundland) and rounding those to whole hours loses real differences.
 * @param {string} remote_tzo - Remote timezone offset string like "+05:30"
 * @returns {number} Absolute difference in minutes
 */
export function getTimezoneDiffMinutes(remote_tzo: string): number;
//# sourceMappingURL=utils.d.ts.map