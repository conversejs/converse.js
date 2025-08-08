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
export function onChatComponentInitialized(el: any): void;
/**
 * @param {string} jid
 */
export function generateFingerprints(jid: string): Promise<any[]>;
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
export type WindowWithLibsignal = any;
export type MessageAttributes = import("@converse/headless/shared/types").MessageAttributes;
export type MUCMessageAttributes = import("@converse/headless/plugins/muc/types").MUCMessageAttributes;
export type ChatBox = import("@converse/headless").ChatBox;
export type BaseMessage = import("@converse/headless/types/shared/message").default;
//# sourceMappingURL=utils.d.ts.map