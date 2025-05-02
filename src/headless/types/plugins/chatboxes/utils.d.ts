export function onClearSession(): Promise<void>;
/**
 * @param {string} jid
 * @param {object} attrs
 * @param {new (attrs: object, options: object) => ChatBox} Model
 */
export function createChatBox(jid: string, attrs: object, Model: new (attrs: object, options: object) => ChatBox): Promise<import("../chat/model.js").default>;
export type ChatBox = import("../chat/model.js").default;
//# sourceMappingURL=utils.d.ts.map