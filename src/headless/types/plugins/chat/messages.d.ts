export default Messages;
/**
 * @extends {Collection<Message>}
 */
declare class Messages extends Collection<Message> {
    constructor();
    comparator: string;
    model: typeof Message;
    fetched: any;
    chatbox: any;
}
import Message from './message.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=messages.d.ts.map