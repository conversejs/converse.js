export function getPlaceholderTemplate(message: any, tpl: any): any;
/**
 * @param {ChatView|MUCView} view
 */
export function fetchMessagesOnScrollUp(view: ChatView | MUCView): Promise<void>;
export type ChatView = import("../chatview/chat.js").default;
export type MUCView = import("../muc-views/muc.js").default;
//# sourceMappingURL=utils.d.ts.map