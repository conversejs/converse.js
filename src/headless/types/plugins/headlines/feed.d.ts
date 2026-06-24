/**
 * Shows headline messages
 */
export default class HeadlinesFeed extends ChatBoxBase {
    /**
     * @param {import('@converse/skeletor').ModelAttributes} attrs
     * @param {import('@converse/skeletor').ModelOptions} options
     */
    constructor(attrs: import("@converse/skeletor").ModelAttributes, options: import("@converse/skeletor").ModelOptions);
    defaults(): {
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