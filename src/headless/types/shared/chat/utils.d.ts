/**
 * @param {ChatBox|MUC} model
 */
export function pruneHistory(model: ChatBox | MUC): void;
/**
 * Given an array of {@link MediaURLMetadata} objects and text, return an
 * array of {@link MediaURL} objects.
 * @param {Array<MediaURLMetadata>} arr
 * @param {String} text
 * @returns{Array<MediaURLData>}
 */
export function getMediaURLs(arr: Array<MediaURLMetadata>, text: string, offset?: number): Array<MediaURLData>;
/**
 * Determines whether the given attributes of an incoming message
 * represent a XEP-0308 correction and, if so, handles it appropriately.
 * @private
 * @method ChatBox#handleCorrection
 * @param {ChatBox|MUC} model
 * @param {object} attrs - Attributes representing a received
 *  message, as returned by {@link parseMessage}
 * @returns {Promise<Message|void>} Returns the corrected
 *  message or `undefined` if not applicable.
 */
export function handleCorrection(model: ChatBox | MUC, attrs: object): Promise<Message | void>;
export const debouncedPruneHistory: any;
export type Message = import('../../plugins/chat/message.js').default;
export type ChatBox = import('../../plugins/chat/model.js').default;
export type MUC = import('../../plugins/muc/muc.js').default;
export type MediaURLData = any;
export type MediaURLMetadata = any;
//# sourceMappingURL=utils.d.ts.map