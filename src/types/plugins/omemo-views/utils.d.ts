/**
 * @param {string} fp
 */
export function formatFingerprint(fp: string): string;
/**
 * @param {string} fp
 */
export function formatFingerprintForQRCode(fp: string): string;
/**
 * @param {import('shared/texture/texture.js').Texture} richtext
 */
export function handleEncryptedFiles(richtext: import("shared/texture/texture.js").Texture): void;
/**
 * @param {import('shared/components/element').CustomElement} el
 */
export function onChatComponentInitialized(el: import("shared/components/element").CustomElement): void;
/**
 * Generate the displayable fingerprints for a contact's devices across both
 * OMEMO versions.
 * @param {string} jid
 */
export function generateFingerprints(jid: string): Promise<void>;
/**
 * @param {string} jid
 * @param {string} device_id
 * @returns {Promise<import('@converse/headless').Device[]>}
 */
export function getDeviceForContact(jid: string, device_id: string): Promise<import("@converse/headless").Device[]>;
/**
 * @param {import('shared/chat/toolbar').ChatToolbar} toolbar_el
 * @param {Array<import('lit').TemplateResult>} buttons
 */
export function getOMEMOToolbarButton(toolbar_el: import("shared/chat/toolbar").ChatToolbar, buttons: Array<import("lit").TemplateResult>): import("lit-html").TemplateResult<1 | 2 | 3>[];
/**
 * Returns the text that explains a failed encrypted send. Headless gives each
 * failure a stable code and keeps its prose out, so the wording lives here.
 * @param {string} [code] - The `code` of the error that failed the send.
 * @param {Element} [iq] - The IQ that failed, when the failure came from the server.
 * @returns {string[]}
 */
export function getSendErrorMessages(code?: string, iq?: Element): string[];
/**
 * Shows a failed send to the user in an alert. Call it once per failed send.
 * @param {Error & {code?: string, iq?: Element}} e
 */
export function alertSendError(e: Error & {
    code?: string;
    iq?: Element;
}): void;
export type WindowWithLibsignal = any;
export type MessageAttributes = import("@converse/headless/types/shared/types").MessageAttributes;
export type MUCMessageAttributes = import("@converse/headless/types/plugins/muc/types").MUCMessageAttributes;
export type ChatBox = import("@converse/headless").ChatBox;
export type BaseMessage = import("@converse/headless/types/shared/message").default;
//# sourceMappingURL=utils.d.ts.map