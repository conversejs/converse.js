/**
 * @param {boolean} reconnecting
 */
export function initStatus(reconnecting: boolean): void;
export function isIdle(): boolean;
export function getIdleSeconds(): number;
/**
 * Resets counters and flags relating to CSI and auto_away/auto_xa
 */
export function onUserActivity(): void;
export function onEverySecond(): void;
/**
 * Send out a Client State Indication (XEP-0352)
 * @function sendCSI
 * @param { String } stat - The user's chat status
 */
export function sendCSI(stat: string): void;
/**
 * Set an interval of one second and register a handler for it.
 * Required for the auto_away, auto_xa and csi_waiting_time features.
 */
export function registerIntervalHandler(): void;
export function tearDown(): void;
//# sourceMappingURL=utils.d.ts.map