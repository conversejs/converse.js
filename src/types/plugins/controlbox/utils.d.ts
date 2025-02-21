export function addControlBox(): any;
/**
 * @param {Event} [ev]
 */
export function showControlBox(ev?: Event | undefined): void;
/**
 * @param {string} jid
 */
export function navigateToControlBox(jid: string): void;
export function disconnect(): void;
export function clearSession(): void;
/**
 * @param {MouseEvent} ev
 */
export function logOut(ev: MouseEvent): Promise<void>;
export function onChatBoxesFetched(): void;
/**
 * Given the login `<form>` element, parse its data and update the
 * converse settings with the supplied JID, password and connection URL.
 * @param {HTMLFormElement} form
 * @param {Object} settings - Extra settings that may be passed in and will
 *  also be set together with the form settings.
 */
export function updateSettingsWithFormData(form: HTMLFormElement, settings?: any): void;
/**
 * @param {HTMLFormElement} form
 */
export function validateJID(form: HTMLFormElement): boolean;
//# sourceMappingURL=utils.d.ts.map