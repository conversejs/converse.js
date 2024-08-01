/**
 * @param {ChatBox|MUC} model
 */
export function pruneHistory(model: ChatBox | MUC): void;
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
export const debouncedPruneHistory: import("lodash").DebouncedFunc<typeof pruneHistory>;
export type Message = import('../../plugins/chat/message.js').default;
export type ChatBox = import('../../plugins/chat/model.js').default;
export type MUC = import('../../plugins/muc/muc.js').default;
export type MediaURLData = any;
//# sourceMappingURL=utils.d.ts.map