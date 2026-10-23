export function removeLiveRegion(): void;
/**
 * Reads out the passed in text to screen reader users.
 * @param {string} text
 */
export function announce(text: string): void;
/**
 * Announces a message which the notifications plugin deemed worth notifying
 * the user about. Messages in a visible chat are skipped, since its message
 * history is already a live region.
 * @param {{ attrs: import('@converse/headless/types/plugins/muc/types').MUCMessageAttributes }} data
 */
export function announceMessage(data: {
    attrs: import("@converse/headless/types/plugins/muc/types").MUCMessageAttributes;
}): void;
/**
 * @returns {import('@converse/headless').ChatBox|import('@converse/headless').MUC|undefined}
 */
export function getVisibleChat(): import("@converse/headless").ChatBox | import("@converse/headless").MUC | undefined;
/**
 * @param {import('@converse/headless').ChatBox|import('@converse/headless').MUC} chatbox
 * @returns {boolean}
 */
export function hasUnreadMessages(chatbox: import("@converse/headless").ChatBox | import("@converse/headless").MUC): boolean;
//# sourceMappingURL=utils.d.ts.map