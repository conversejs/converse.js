export function isMessageToHiddenChat(attrs: any): any;
export function areDesktopNotificationsEnabled(): any;
/**
 * @typedef {Navigator & {clearAppBadge: Function, setAppBadge: Function} } navigator
 */
export function clearFavicon(): void;
export function updateUnreadFavicon(): void;
/**
 * Is this a group message for which we should notify the user?
 * @param {MUCMessageAttributes} attrs
 */
export function shouldNotifyOfGroupMessage(attrs: MUCMessageAttributes): Promise<any>;
export function showFeedbackNotification(data: any): void;
/**
 * Event handler for the on('message') event. Will call methods
 * to play sounds and show HTML5 notifications.
 */
export function handleMessageNotification(data: any): Promise<false | undefined>;
export function handleFeedback(data: any): void;
/**
 * Event handler for on('contactPresenceChanged').
 * Will show an HTML5 notification to indicate that the chat status has changed.
 * @param {RosterContact} contact
 */
export function handleChatStateNotification(contact: RosterContact): void;
/**
 * @param {RosterContact} contact
 */
export function handleContactRequestNotification(contact: RosterContact): void;
export function requestPermission(): void;
export type navigator = Navigator & {
    clearAppBadge: Function;
    setAppBadge: Function;
};
export type MUCMessageAttributes = import("@converse/headless/plugins/muc/types").MUCMessageAttributes;
export type MUCMessageData = any;
export type MessageData = any;
export type RosterContact = import("@converse/headless").RosterContact;
//# sourceMappingURL=utils.d.ts.map