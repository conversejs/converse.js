export function formatFingerprint(fp: any): any;
export function formatFingerprintForQRCode(fp: any): string;
/**
 * @param {Error|IQError|UserFacingError} e
 * @param {ChatBox} chat
 */
export function handleMessageSendError(e: Error | IQError | UserFacingError, chat: ChatBox): void;
export function contactHasOMEMOSupport(jid: any): Promise<boolean>;
export function getOutgoingMessageAttributes(chat: any, attrs: any): any;
/**
 * @param {File} file
 * @returns {Promise<File>}
 */
export function encryptFile(file: File): Promise<File>;
export function setEncryptedFileURL(message: any, attrs: any): any;
export function handleEncryptedFiles(richtext: any): void;
/**
 * Hook handler for { @link parseMessage } and { @link parseMUCMessage }, which
 * parses the passed in `message` stanza for OMEMO attributes and then sets
 * them on the attrs object.
 * @param { Element } stanza - The message stanza
 * @param { (MUCMessageAttributes|MessageAttributes) } attrs
 * @returns (MUCMessageAttributes|MessageAttributes)
 */
export function parseEncryptedMessage(stanza: Element, attrs: (MUCMessageAttributes | MessageAttributes)): Promise<any>;
export function onChatBoxesInitialized(): void;
export function onChatInitialized(el: any): void;
export function getSessionCipher(jid: any, id: any): any;
/**
 * Given an XML element representing a user's OMEMO bundle, parse it
 * and return a map.
 */
export function parseBundle(bundle_el: any): {
    identity_key: any;
    signed_prekey: {
        id: number;
        public_key: any;
        signature: any;
    };
    prekeys: any;
};
export function generateFingerprints(jid: any): Promise<any[]>;
export function generateFingerprint(device: any): Promise<void>;
export function getDevicesForContact(jid: any): Promise<any>;
export function getDeviceForContact(jid: any, device_id: any): Promise<any>;
export function generateDeviceID(): Promise<any>;
export function getSession(device: any): Promise<any>;
export function registerPEPPushHandler(): void;
export function restoreOMEMOSession(): Promise<void>;
export function initOMEMO(reconnecting: any): Promise<void>;
export function getOMEMOToolbarButton(toolbar_el: any, buttons: any): any;
export function createOMEMOMessageStanza(chat: any, data: any): Promise<any>;
export namespace omemo {
    export { decryptMessage };
    export { encryptMessage };
    export { formatFingerprint };
}
export type WindowWithLibsignal = any;
export type MessageAttributes = import("@converse/headless/shared/types").MessageAttributes;
export type MUCMessageAttributes = import("@converse/headless/plugins/muc/types").MUCMessageAttributes;
export type ChatBox = import("@converse/headless").ChatBox;
import { IQError } from 'shared/errors.js';
import { UserFacingError } from 'shared/errors.js';
declare function decryptMessage(obj: any): Promise<string>;
/**
 * @param {string} plaintext
 */
declare function encryptMessage(plaintext: string): Promise<{
    key: ArrayBuffer;
    tag: ArrayBuffer;
    key_and_tag: ArrayBufferLike;
    payload: string;
    iv: string;
}>;
export {};
//# sourceMappingURL=utils.d.ts.map