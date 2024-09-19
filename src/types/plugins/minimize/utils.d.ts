/**
 * @param {ChatBox|MUC} chat
 */
export function initializeChat(chat: ChatBox | MUC): void;
/**
 * This method is called when a newly created chat box will be shown.
 * It checks whether there is enough space on the page to show
 * another chat box. Otherwise it minimizes the oldest chat box
 * to create space.
 * @param {ChatView|MUCView|ControlBoxView|HeadlinesFeedView} [newchat]
 */
export function trimChats(newchat?: ChatView | MUCView | ControlBoxView | HeadlinesFeedView): void;
export function addMinimizeButtonToChat(view: any, buttons: any): any[];
export function addMinimizeButtonToMUC(view: any, buttons: any): any[];
export function maximize(ev: any, chatbox: any): void;
export function minimize(ev: any, model: any): void;
/**
 * @param {ChatBox|MUC} model
 */
export function onMinimizedChanged(model: ChatBox | MUC): void;
export type MUC = import("@converse/headless").MUC;
export type ChatBox = import("@converse/headless").ChatBox;
export type ChatView = import("plugins/chatview/chat").default;
export type MUCView = import("plugins/muc-views/muc").default;
export type ControlBoxView = import("plugins/controlbox/controlbox").default;
export type HeadlinesFeedView = import("plugins/headlines-view/view").default;
//# sourceMappingURL=utils.d.ts.map