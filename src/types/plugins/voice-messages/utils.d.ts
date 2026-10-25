/**
 * @typedef {import('@converse/headless').ChatBox|import('@converse/headless').MUC} ChatModel
 * @typedef {import('./session.js').Recording} Recording
 */
/**
 * @param {number} ms
 * @returns {string} The duration as m:ss
 */
export function formatDuration(ms: number): string;
/**
 * Open the recorder in the given chat, closing any other open recorder, so
 * that only one recording is active at a time.
 * @param {ChatModel} model
 */
export function openRecorder(model: ChatModel): void;
/**
 * How long a recording at `bitrate` can be before it outgrows the upload
 * service's file size limit, in seconds, so that whatever gets recorded can
 * be sent. `Infinity` when the service doesn't state a limit, or there is
 * no service.
 * @param {number} bitrate - In bits per second
 * @returns {Promise<number>}
 */
export function getUploadDurationLimit(bitrate: number): Promise<number>;
/**
 * `getAttachmentMenuItems` handler: the "Record a voice message" item, listed
 * once the server is known to offer HTTP File Upload.
 * @param {import('shared/chat/attachment-menu').default} menu
 * @param {import('shared/chat/types').AttachmentMenuItem[]} items
 */
export function getVoiceMessageItem(menu: import("shared/chat/attachment-menu").default, items: import("shared/chat/types").AttachmentMenuItem[]): Promise<import("shared/chat/types").AttachmentMenuItem[]>;
/**
 * `getComposerPanels` handler: the recorder, which renders nothing until opened.
 * @param {import('shared/chat/composer-panels').default} container
 * @param {import('shared/chat/types').ComposerPanelEntry[]} panels
 */
export function getRecorderPanel(container: import("shared/chat/composer-panels").default, panels: import("shared/chat/types").ComposerPanelEntry[]): import("shared/chat/types").ComposerPanelEntry[];
/**
 * Upload a recording and send it out as a file message.
 * Resolves once the upload has succeeded.
 * @param {ChatModel} model
 * @param {Recording} recording
 * @throws {Error} if the file could not be uploaded, with a message for the user.
 */
export function sendVoiceMessage(model: ChatModel, recording: Recording): Promise<void>;
export const IDLE: "idle";
export const REQUESTING: "requesting-permission";
export const RECORDING: "recording";
export const PAUSED: "paused";
export const UPLOADING: "uploading";
export const ERROR: "error";
export type ChatModel = import("@converse/headless").ChatBox | import("@converse/headless").MUC;
export type Recording = import("./session.js").Recording;
//# sourceMappingURL=utils.d.ts.map