export function addControlBox(): any;
export function showControlBox(ev: any): void;
export function navigateToControlBox(jid: any): void;
export function disconnect(): any;
export function clearSession(): void;
export function onChatBoxesFetched(): void;
/**
 * Given the login `<form>` element, parse its data and update the
 * converse settings with the supplied JID, password and connection URL.
 * @param { HTMLElement } form
 * @param { Object } settings - Extra settings that may be passed in and will
 *  also be set together with the form settings.
 */
export function updateSettingsWithFormData(form: HTMLElement, settings?: any): void;
export function validateJID(form: any): boolean;
