/**
 * Advertises XEP-0202 support in our own disco#info, which XEP-0202 § 3
 * requires of any entity that answers time queries. Nothing is advertised when
 * `send_entity_time` is disabled, since we then answer with an error.
 */
export function addClientFeatures(): void;
/**
 * Registers the XEP-0202 time handler
 */
export function registerTimeHandler(): any;
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
 * Formats the current time in a remote timezone as HH:MM
 * @param {Date} now - The current time (e.g., new Date())
 * @param {string} tzo - Timezone offset string like "+05:30"
 * @returns {string} Time string in HH:MM format
 */
export function formatRemoteTime(now: Date, tzo: string): string;
/**
 * Gets the local (browser) timezone offset in minutes
 * @returns {number} Offset in minutes (positive = ahead of UTC)
 */
export function getLocalTZOMinutes(): number;
/**
 * Calculates the absolute difference in hours between two timezones
 * @param {string} remote_tzo - Remote timezone offset string like "+05:30"
 * @returns {number} Absolute difference in hours
 */
export function getTimezoneDiffHours(remote_tzo: string): number;
//# sourceMappingURL=utils.d.ts.map