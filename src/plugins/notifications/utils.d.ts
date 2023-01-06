export function isMessageToHiddenChat(attrs: any): any;
export function areDesktopNotificationsEnabled(): any;
export function clearFavicon(): void;
export function updateUnreadFavicon(): void;
/**
 * Is this a group message for which we should notify the user?
 * @private
 * @param { MUCMessageAttributes } attrs
 */
export function shouldNotifyOfGroupMessage(attrs: MUCMessageAttributes): Promise<any>;
export function showFeedbackNotification(data: any): void;
/**
 * Event handler for the on('message') event. Will call methods
 * to play sounds and show HTML5 notifications.
 */
export function handleMessageNotification(data: any): Promise<boolean>;
export function handleFeedback(data: any): void;
/**
 * Event handler for on('contactPresenceChanged').
 * Will show an HTML5 notification to indicate that the chat status has changed.
 */
export function handleChatStateNotification(contact: any): void;
export function handleContactRequestNotification(contact: any): void;
export function requestPermission(): void;
