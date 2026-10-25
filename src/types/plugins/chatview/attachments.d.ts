/**
 * @typedef {import('@converse/headless').ChatBox|import('@converse/headless').MUC} ChatModel
 */
/**
 * `getAttachmentMenuItems` handler: the built-in items, listed only where they
 * work. The `visible_toolbar_buttons` keys that used to show or hide the
 * toolbar buttons now show or hide the matching items.
 * @param {import('shared/chat/attachment-menu').default} menu
 * @param {import('shared/chat/types').AttachmentMenuItem[]} items
 */
export function getAttachmentMenuItems(menu: import("shared/chat/attachment-menu").default, items: import("shared/chat/types").AttachmentMenuItem[]): Promise<import("shared/chat/types").AttachmentMenuItem[]>;
/**
 * Ask for confirmation, then send the device's position to the chat as a geo
 * URI, or say why that couldn't be done. Does nothing while an earlier call
 * for the same chat is still pending.
 * @param {ChatModel} model
 * @returns {Promise<void>} Resolves once the message is sent or the attempt given up.
 */
export function shareLocation(model: ChatModel): Promise<void>;
export const FILE_ORDER: 100;
export const IMAGE_ORDER: 200;
export const LOCATION_ORDER: 300;
export type ChatModel = import("@converse/headless").ChatBox | import("@converse/headless").MUC;
//# sourceMappingURL=attachments.d.ts.map