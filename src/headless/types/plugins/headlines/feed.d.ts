/**
 * Shows headline messages
 * @class
 * @namespace _converse.HeadlinesFeed
 * @memberOf _converse
 */
export default class HeadlinesFeed extends ChatBox {
    defaults(): {
        bookmarked: boolean;
        hidden: boolean;
        message_type: string;
        num_unread: number;
        time_opened: any;
        time_sent: any;
        type: string;
    };
}
import ChatBox from '../../plugins/chat/model.js';
//# sourceMappingURL=feed.d.ts.map