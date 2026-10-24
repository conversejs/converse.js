export function removeLiveRegion(): void;
/**
 * Reads out the passed in text to screen reader users.
 * @param {string} text
 */
export function announce(text: string): void;
/**
 * Announces a received message which is worth drawing the user's attention
 * to. Messages in a visible chat are skipped, since its message history is
 * already a live region.
 * @param {import('plugins/notifications/types').MessageNotificationData} data
 */
export function announceMessage(data: import("plugins/notifications/types").MessageNotificationData): Promise<void>;
/**
 * @returns {Array<import('@converse/headless').ChatBox|import('@converse/headless').MUC>}
 */
export function getChats(): Array<import("@converse/headless").ChatBox | import("@converse/headless").MUC>;
/**
 * Returns the chat the user is in: the one that has focus, or else the most
 * recently opened one which is visible. In the "overlayed" view mode several
 * chats can be visible at once.
 * @returns {import('@converse/headless').ChatBox|import('@converse/headless').MUC|undefined}
 */
export function getActiveChat(): import("@converse/headless").ChatBox | import("@converse/headless").MUC | undefined;
/**
 * @param {import('@converse/headless').ChatBox|import('@converse/headless').MUC} chatbox
 * @returns {boolean}
 */
export function hasUnreadMessages(chatbox: import("@converse/headless").ChatBox | import("@converse/headless").MUC): boolean;
//# sourceMappingURL=utils.d.ts.map