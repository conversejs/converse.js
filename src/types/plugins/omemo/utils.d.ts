/**
 * @param {string} fp
 */
export function formatFingerprint(fp: string): string;
/**
 * @param {string} fp
 */
export function formatFingerprintForQRCode(fp: string): string;
/**
 * @param {Error|IQError|UserFacingError} e
 * @param {ChatBox} chat
 */
export function handleMessageSendError(e: Error | IQError | UserFacingError, chat: ChatBox): void;
/**
 * @param {string} jid
 */
export function contactHasOMEMOSupport(jid: string): Promise<boolean>;
/**
 * @param {ChatBox|MUC} chat
 * @param {MessageAttributes} attrs
 * @return {MessageAttributes}
 */
export function getOutgoingMessageAttributes(chat: ChatBox | MUC, attrs: MessageAttributes): MessageAttributes;
/**
 * @param {File} file
 * @returns {Promise<File>}
 */
export function encryptFile(file: File): Promise<File>;
/**
 * @param {import('@converse/headless/types/shared/message').default} message
 * @param {import('@converse/headless/shared/types').FileUploadMessageAttributes} attrs
 */
export function setEncryptedFileURL(message: import("@converse/headless").BaseMessage<any>, attrs: import("@converse/headless/shared/types").FileUploadMessageAttributes): import("@converse/headless/shared/types").FileUploadMessageAttributes & {
    oob_url: any;
    message: string;
    body: string;
};
/**
 * @param {import('shared/texture/texture.js').Texture} richtext
 */
export function handleEncryptedFiles(richtext: import("shared/texture/texture.js").Texture): void;
/**
 * Hook handler for {@link parseMessage} and {@link parseMUCMessage}, which
 * parses the passed in `message` stanza for OMEMO attributes and then sets
 * them on the attrs object.
 * @param {Element} stanza - The message stanza
 * @param {MUCMessageAttributes|MessageAttributes} attrs
 * @returns {Promise<MUCMessageAttributes| MessageAttributes|
        import('./types').MUCMessageAttrsWithEncryption|import('./types').MessageAttrsWithEncryption>}
 */
export function parseEncryptedMessage(stanza: Element, attrs: MUCMessageAttributes | MessageAttributes): Promise<MUCMessageAttributes | MessageAttributes | import("./types").MUCMessageAttrsWithEncryption | import("./types").MessageAttrsWithEncryption>;
export function onChatBoxesInitialized(): void;
export function onChatInitialized(el: any): void;
/**
 * @param {string} jid
 * @param {number} id
 */
export function getSessionCipher(jid: string, id: number): any;
/**
 * Given an XML element representing a user's OMEMO bundle, parse it
 * and return a map.
 * @param {Element} bundle_el
 * @returns {import('./types').Bundle}
 */
export function parseBundle(bundle_el: Element): import("./types").Bundle;
/**
 * @param {string} jid
 */
export function generateFingerprints(jid: string): Promise<any[]>;
/**
 * @param {import('./device.js').default} device
 */
export function generateFingerprint(device: import("./device.js").default): Promise<void>;
/**
 * @param {string} jid
 * @returns {Promise<import('./devices.js').default>}
 */
export function getDevicesForContact(jid: string): Promise<import("./devices.js").default>;
/**
 * @param {string} jid
 * @param {string} device_id
 * @returns {Promise<import('./device.js').default[]>}
 */
export function getDeviceForContact(jid: string, device_id: string): Promise<import("./device.js").default[]>;
export function generateDeviceID(): Promise<any>;
/**
 * @param {import('./device.js').default} device
 */
export function getSession(device: import("./device.js").default): Promise<any>;
/**
 * Register a pubsub handler for devices pushed from other connected clients
 */
export function registerPEPPushHandler(): void;
export function restoreOMEMOSession(): Promise<void>;
/**
 * @param {boolean} reconnecting
 */
export function initOMEMO(reconnecting: boolean): Promise<void>;
/**
 * @param {import('shared/chat/toolbar').ChatToolbar} toolbar_el
 * @param {Array<import('lit').TemplateResult>} buttons
 */
export function getOMEMOToolbarButton(toolbar_el: import("shared/chat/toolbar").ChatToolbar, buttons: Array<import("lit").TemplateResult>): import("lit-html").TemplateResult<1 | 2 | 3>[];
/**
 * @param {MUC|ChatBox} chat
 * @param {{ message: BaseMessage, stanza: import('strophe.js').Builder }} data
 * @return {Promise<{ message: BaseMessage, stanza: import('strophe.js').Builder }>}
 */
export function createOMEMOMessageStanza(chat: MUC | ChatBox, data: {
    message: BaseMessage;
    stanza: import("strophe.js").Builder;
}): Promise<{
    message: BaseMessage;
    stanza: import("strophe.js").Builder;
}>;
export namespace omemo {
    export { decryptMessage };
    export { encryptMessage };
    export { formatFingerprint };
}
export type WindowWithLibsignal = any;
export type MessageAttributes = import("@converse/headless/shared/types").MessageAttributes;
export type MUCMessageAttributes = import("@converse/headless/plugins/muc/types").MUCMessageAttributes;
export type ChatBox = import("@converse/headless").ChatBox;
export type BaseMessage = import("@converse/headless").BaseMessage<any>;
import { IQError } from "shared/errors.js";
import { UserFacingError } from "shared/errors.js";
import { MUC } from "@converse/headless";
/**
 * @param {import('./types').EncryptedMessage} obj
 * @returns {Promise<string>}
 */
declare function decryptMessage(obj: import("./types").EncryptedMessage): Promise<string>;
/**
 * @param {string} plaintext
 * @returns {Promise<import('./types').EncryptedMessage>}
 */
declare function encryptMessage(plaintext: string): Promise<import("./types").EncryptedMessage>;
export {};
//# sourceMappingURL=utils.d.ts.map