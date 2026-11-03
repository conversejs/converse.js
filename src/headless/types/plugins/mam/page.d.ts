/**
 * The newest `limit` messages of a conversation that are older than `before`
 * (if given) and no older than `since` (if given), fetching from the archive
 * whatever of that stretch isn't held locally.
 * @param {ChatBox|MUC} chat
 * @param {import('./types').ArchivePageOptions} options
 * @returns {Promise<BaseMessage[]>} Oldest first
 */
export function getPage(chat: ChatBox | MUC, { limit, before, since, filter }: import("./types").ArchivePageOptions): Promise<BaseMessage[]>;
export type ChatBox = import("../chat/model").default;
export type MUC = import("../muc/muc").default;
export type BaseMessage = import("../../shared/message").default;
//# sourceMappingURL=page.d.ts.map