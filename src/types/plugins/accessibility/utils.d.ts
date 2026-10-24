export function removeLiveRegion(): void;
/**
 * Reads out the passed in text to screen reader users.
 * @param {string} text
 */
export function announce(text: string): void;
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