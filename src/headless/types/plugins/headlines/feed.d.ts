/**
 * Shows headline messages
 */
export default class HeadlinesFeed extends ChatBoxBase {
    constructor(attrs: any, options: any);
    defaults(): {
        bookmarked: boolean;
        hidden: boolean;
        message_type: string;
        num_unread: number;
        time_opened: any;
        time_sent: any;
        type: string;
    };
    initialize(): Promise<void>;
}
import ChatBoxBase from '../../shared/chatbox.js';
//# sourceMappingURL=feed.d.ts.map