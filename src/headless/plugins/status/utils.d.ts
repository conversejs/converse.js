export function initStatus(reconnecting: any): void;
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
export function addStatusToMUCJoinPresence(_: any, stanza: any): any;
