import type { MessageEventData, MUCMessageEventData } from '@converse/headless';

// The data of the `message` event, for any kind of chat
export type MessageNotificationData = MessageEventData | MUCMessageEventData;
