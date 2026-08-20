/**
 * @param {string} from - The JID of the sender
 * @returns {boolean}
 */
export function isMessageToHiddenChat(from: string): boolean;
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
export function playSoundNotification(): Promise<void>;
/**
 * Event handler for the on('message') event. Will call methods
 * to play sounds and show HTML5 notifications.
 */
export function handleMessageNotification(data: any): Promise<boolean>;
export function handleFeedback(data: any): void;
/**
 * Event handler for on('microblogNotification'). Raises a desktop notification
 * (and sound) for a comment on, or a ♥ like of, one of the user's own posts,
 * subject to the same enabled/visibility gating as chat messages.
 * @param {MicroblogNotificationData} data
 */
export function handleMicroblogNotification(data: MicroblogNotificationData): void;
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
export type MUCMessageAttributes = import("@converse/headless/types/plugins/muc/types").MUCMessageAttributes;
export type MUCMessageData = any;
export type MessageData = any;
export type RosterContact = import("@converse/headless").RosterContact;
export type PubSubMessage = import("@converse/headless").PubSubMessage;
export type PostRef = {
    feedJid: string;
    node: string;
    itemId: string;
};
export type MicroblogNotificationData = {
    type: "comment" | "like";
    post?: PubSubMessage;
    comment: PubSubMessage;
    ref: PostRef;
};
//# sourceMappingURL=utils.d.ts.map