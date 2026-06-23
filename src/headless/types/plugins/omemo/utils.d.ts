/**
 * Returns a VersionedOMEMOStore proxy for the given OMEMO version.
 *
 * The proxy implements the subset of libomemo's `OMEMOStore` interface that
 * `SessionCipher` and `SessionBuilder` actually exercise at runtime (the
 * crypto/session methods); the interface's raw key-value members
 * (`store`/`put`/`get`/`remove`) are part of the reference `InMemoryStore` and
 * are never called on a consumer store, so we present the proxy as an
 * `OMEMOStore` here.
 * @param {import('./types').OMEMOVersion} version
 * @returns {import('libomemo.js').OMEMOStore}
 */
export function getVersionedStore(version: import("./types").OMEMOVersion): import("libomemo.js").OMEMOStore;
/**
 * Register a pubsub handler for devices pushed from other connected clients
 */
export function registerPEPPushHandler(): void;
/**
 * Returns the remembered OMEMO active state for a chat, or `undefined` if the
 * user has never made an explicit choice for it.
 * @param {string} jid
 * @returns {boolean|undefined}
 */
export function getOMEMOActiveState(jid: string): boolean | undefined;
/**
 * Persists the user's explicit choice to enable/disable OMEMO for a chat, so
 * that it's remembered the next time the chat is opened.
 * @param {string} jid
 * @param {boolean} active
 */
export function setOMEMOActiveState(jid: string, active: boolean): void;
/**
 * @param {boolean} reconnecting
 */
export function initOMEMO(reconnecting: boolean): Promise<void>;
/**
 * @param {String} jid - The Jabber ID for which the device list will be returned.
 * @param {boolean} [create=false] - Set to `true` if the device list should be
 *      created if it cannot be found.
 * @param {import('./types').OMEMOVersion} [version] - Defaults to legacy version.
 */
export function getDeviceList(jid: string, create?: boolean, version?: import("./types").OMEMOVersion): Promise<any>;
/**
 * @param {import('./device.js').default} device
 */
export function generateFingerprint(device: import("./device.js").default): Promise<void>;
/**
 * Surface a user-facing alert for a failed encrypted send and re-throw, so the
 * send pipeline (the `createMessageStanza` handler) aborts. Always throws.
 * @param {Error|errors.IQError|errors.UserFacingError} e
 * @param {import('../../shared/chatbox.js').default} chat
 * @returns {never}
 */
export function handleMessageSendError(e: Error | errors.IQError | errors.UserFacingError, chat: import("../../shared/chatbox.js").default): never;
/**
 * Returns the device collection for a contact and OMEMO version.
 * Doesn't throw on any failure, instead logs and returns an empty collection.
 * @param {string} jid
 * @param {import('./types').OMEMOVersion} [version]
 * @returns {Promise<import('./devices.js').default>}
 */
export function getDevicesForContact(jid: string, version?: import("./types").OMEMOVersion): Promise<import("./devices.js").default>;
/**
 * @param {string} jid
 * @param {number} id
 * @param {import('./types').OMEMOVersion} [version]
 * @returns {Promise<import('libomemo.js').SessionCipher>}
 */
export function getSessionCipher(jid: string, id: number, version?: import("./types").OMEMOVersion): Promise<import("libomemo.js").SessionCipher>;
/**
 * @param {import('./device').default} device
 * @param {import('./types').OMEMOVersion} [version]
 */
export function getSession(device: import("./device").default, version?: import("./types").OMEMOVersion): Promise<string | void>;
/**
 * @param {import('./types').EncryptedMessage} obj
 * @returns {Promise<string>}
 */
export function decryptMessage(obj: import("./types").EncryptedMessage): Promise<string>;
/**
 * Send an OMEMO heartbeat (an empty/payload-less OMEMO message) to `chat` for
 * the given protocol version. Heartbeats forward the Double Ratchet so a peer's
 * message counter restarts at 0; see the XEP-0384 "counter of 53 or higher"
 * rule. The message carries no `<body>`, so it produces no visible/stored chat
 * message. We reuse the normal send-path session setup so every (trusted,
 * active) device gets the heartbeat and any missing sessions are (re)built.
 * @param {import('../../shared/chatbox.js').default} chat
 * @param {import('./types').OMEMOVersion} version
 */
export function sendOMEMOHeartbeat(chat: import("../../shared/chatbox.js").default, version: import("./types").OMEMOVersion): Promise<void>;
/**
 * Send a XEP-0333 chat marker for an OMEMO-active chat.
 *
 * Called from {@link sendMarker} in `shared/actions.js` when `omemo_active` is
 * set. The cleartext path is suppressed in that case, so this function is solely
 * responsible for the outgoing marker in encrypted sessions.
 *
 * - OMEMO:2 devices present → encrypted SCE stanza.
 * - Legacy-only session (no v2 devices) → cleartext marker, matching what
 *   other clients do for legacy OMEMO.
 * - Mixed session (both v2 and legacy devices) → encrypted only; legacy
 *   devices in a mixed session do not receive the marker.
 *
 * @param {import('../../shared/chatbox.js').default} chatbox
 * @param {string} to_jid
 * @param {string} msg_id - the `id` of the message being marked
 * @param {string} type - marker type ('displayed', 'received', 'acknowledged')
 * @param {string} [msg_type] - 'chat' or 'groupchat'; defaults to 'chat'
 */
export function sendOMEMO2Marker(chatbox: import("../../shared/chatbox.js").default, to_jid: string, msg_id: string, type: string, msg_type?: string): Promise<void>;
/**
 * Encrypt `plaintext` (and, for omemo:2, `extensions` inside the SCE
 * `<content>`) for every reachable recipient device of `chat`, returning the
 * OMEMO `<encrypted>` element(s) to attach to a message stanza plus the EME
 * (XEP-0380) namespace to advertise.
 *
 * @param {import('../../shared/chatbox').default} chat
 * @param {string|null} plaintext - the body (legacy payload / omemo:2 SCE `<body>`)
 * @param {import('strophe.js').Builder[]} [extensions] - encrypted SCE `<content>` children
 * @returns {Promise<{elements: import('strophe.js').Builder[], eme_ns: string}>}
 */
export function getEncryptedElements(chat: import("../../shared/chatbox").default, plaintext: string | null, extensions?: import("strophe.js").Builder[]): Promise<{
    elements: import("strophe.js").Builder[];
    eme_ns: string;
}>;
/**
 * Handler for the `createMessageStanza` hook: for an encrypted outgoing chat
 * message, attach the OMEMO `<encrypted>` element(s) (plus store + EME hints) to
 * the stanza that was built from the Message model. Non-encrypted messages pass
 * through untouched. A send failure is surfaced to the user via
 * {@link handleMessageSendError} (which re-throws to abort the send).
 *
 * @param {import('../../shared/chatbox').default} chat
 * @param {import('../../shared/types').MessageAndStanza} data
 * @return {Promise<import('../../shared/types').MessageAndStanza>}
 */
export function createMessageStanzaHandler(chat: import("../../shared/chatbox").default, data: import("../../shared/types").MessageAndStanza): Promise<import("../../shared/types").MessageAndStanza>;
/**
 * @param {import('../../shared/chatbox.js').default} chat
 * @param {import('../../shared/types').MessageAttributes} attrs
 * @return {import('../../shared/types').MessageAttributes}
 */
export function getOutgoingMessageAttributes(chat: import("../../shared/chatbox.js").default, attrs: import("../../shared/types").MessageAttributes): import("../../shared/types").MessageAttributes;
/**
 * Checks whether the contact advertises any OMEMO-compatible devices.
 * Legacy is checked first and short-circuits.
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