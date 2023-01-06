export function initializeChat(chat: any): void;
/**
 * This method is called when a newly created chat box will be shown.
 * It checks whether there is enough space on the page to show
 * another chat box. Otherwise it minimizes the oldest chat box
 * to create space.
 * @private
 * @method _converse.ChatBoxViews#trimChats
 * @param { _converse.ChatBoxView|_converse.ChatRoomView|_converse.ControlBoxView|_converse.HeadlinesFeedView } [newchat]
 */
export function trimChats(newchat?: _converse.ChatBoxView | _converse.ChatRoomView | _converse.ControlBoxView | _converse.HeadlinesFeedView): void;
export function addMinimizeButtonToChat(view: any, buttons: any): any[];
export function addMinimizeButtonToMUC(view: any, buttons: any): any[];
export function maximize(ev: any, chatbox: any): void;
export function minimize(ev: any, model: any): void;
export function onMinimizedChanged(model: any): void;
