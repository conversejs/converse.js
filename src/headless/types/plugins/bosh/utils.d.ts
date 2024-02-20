export function startNewPreboundBOSHSession(): void;
/**
 * @param {unknown} _
 * @param {LoginHookPayload} payload
 */
export function attemptPrebind(_: unknown, payload: any): Promise<any>;
export function saveJIDToSession(): void;
export function clearSession(): void;
export function restoreBOSHSession(): Promise<boolean>;
export type LoginHookPayload = any;
//# sourceMappingURL=utils.d.ts.map