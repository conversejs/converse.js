/**
 * Register a pubsub handler for devices pushed from other connected clients
 */
export function registerPEPPushHandler(): void;
/**
 * @param {boolean} reconnecting
 */
export function initOMEMO(reconnecting: boolean): Promise<void>;
/**
 * @param {String} jid - The Jabber ID for which the device list will be returned.
 * @param {boolean} [create=false] - Set to `true` if the device list
 *      should be created if it cannot be found.
 */
export function getDeviceList(jid: string, create?: boolean): Promise<any>;
/**
 * @param {import('./device.js').default} device
 */
export function generateFingerprint(device: import("./device.js").default): Promise<void>;
/**
 * @param {Error|errors.IQError|errors.UserFacingError} e
 * @param {import('../../shared/chatbox.js').default} chat
 */
export function handleMessageSendError(e: Error | errors.IQError | errors.UserFacingError, chat: import("../../shared/chatbox.js").default): void;
/**
 * @param {string} jid
 * @returns {Promise<import('./devices.js').default>}
 */
export function getDevicesForContact(jid: string): Promise<import("./devices.js").default>;
/**
 * @param {string} jid
 * @param {number} id
 */
export function getSessionCipher(jid: string, id: number): any;
/**
 * @param {import('./device.js').default} device
 */
export function getSession(device: import("./device.js").default): Promise<any>;
/**
 * @param {import('./types').EncryptedMessage} obj
 * @returns {Promise<string>}
 */
export function decryptMessage(obj: import("./types").EncryptedMessage): Promise<string>;
/**
 * @param {import('../../shared/chatbox.js').default} chat
 * @param {import('../../shared/types').MessageAndStanza} data
 * @return {Promise<import('../../shared/types').MessageAndStanza>}
 */
export function createOMEMOMessageStanza(chat: import("../../shared/chatbox.js").default, data: import("../../shared/types").MessageAndStanza): Promise<import("../../shared/types").MessageAndStanza>;
/**
 * @param {import('../../shared/chatbox.js').default} chat
 * @param {import('../../shared/types').MessageAttributes} attrs
 * @return {import('../../shared/types').MessageAttributes}
 */
export function getOutgoingMessageAttributes(chat: import("../../shared/chatbox.js").default, attrs: import("../../shared/types").MessageAttributes): import("../../shared/types").MessageAttributes;
/**
 * @param {string} jid
 */
export function contactHasOMEMOSupport(jid: string): Promise<boolean>;
/**
 * @param {import('../../shared/chatbox.js').default} chatbox
 */
export function onChatInitialized(chatbox: import("../../shared/chatbox.js").default): void;
/**
 * @param {import('../../shared/message').default} message
 * @param {import('../../shared/types').FileUploadMessageAttributes} attrs
 */
export function setEncryptedFileURL(message: import("../../shared/message").default, attrs: import("../../shared/types").FileUploadMessageAttributes): import("../../shared/types").FileUploadMessageAttributes;
/**
 * @param {File} file
 * @returns {Promise<File>}
 */
export function encryptFile(file: File): Promise<File>;
import { errors } from '../../shared/index.js';
//# sourceMappingURL=utils.d.ts.map