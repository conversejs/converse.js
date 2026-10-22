import { MessageEventData } from '@converse/headless/types/shared/types';
import { MUCMessageEventData } from '@converse/headless/types/plugins/muc/types';

// The data of the `message` event, for any kind of chat
export type MessageNotificationData = MessageEventData | MUCMessageEventData;
