export default Message;
/**
 * Represents a (non-MUC) message.
 * These can be either `chat`, `normal` or `headline` messages.
 * @namespace _converse.Message
 * @memberOf _converse
 * @example const msg = new Message({'message': 'hello world!'});
 */
declare class Message extends BaseMessage<any> {
    constructor(models?: import("@converse/skeletor").Model[], options?: object);
    initialize(): Promise<void>;
    initialized: any;
    setContact(): Promise<void>;
    getDisplayName(): any;
}
import BaseMessage from '../../shared/message.js';
//# sourceMappingURL=message.d.ts.map