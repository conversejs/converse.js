/**
 * @param {string} stat
 */
export function getPrettyStatus(stat: string): any;
/**
 * For certain auth mechanisms, it doesn't make sense to show the password
 * form.
 */
export function shouldShowPasswordResetForm(): boolean;
/**
 * Send out a Client State Indication (XEP-0352)
 * @function sendCSI
 * @param { String } stat - The user's chat status
 */
export function sendCSI(stat: string): void;
/**
 * Resets counters and flags relating to CSI and auto_away/auto_xa
 */
export function onUserActivity(): void;
/**
 * An interval handler running every second.
 * Used for CSI and the auto_away and auto_xa features.
 */
export function onEverySecond(): void;
/**
 * Set an interval of one second and register a handler for it.
 * Required for the auto_away, auto_xa and csi_waiting_time features.
 */
export function registerIntervalHandler(): void;
export function tearDown(): void;
//# sourceMappingURL=utils.d.ts.map