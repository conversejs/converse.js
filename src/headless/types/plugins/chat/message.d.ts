export default Message;
/**
 * Represents a (non-MUC) message.
 * These can be either `chat`, `normal` or `headline` messages.
 * @namespace _converse.Message
 * @memberOf _converse
 * @example const msg = new Message({'message': 'hello world!'});
 */
declare class Message extends BaseMessage {
    initialize(): Promise<void>;
    initialized: Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    setContact(): any;
    getDisplayName(): any;
}
import BaseMessage from '../../shared/message.js';
//# sourceMappingURL=message.d.ts.map