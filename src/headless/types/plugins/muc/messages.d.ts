export default MUCMessages;
/**
 * Collection which stores MUC messages
 * @extends {Collection<MUCMessage>}
 */
declare class MUCMessages extends Collection<MUCMessage> {
    /**
     * @param {import('@converse/skeletor').ModelAttributes[]} [models]
     * @param {import('@converse/skeletor').CollectionOptions<MUCMessage>} [options]
     */
    constructor(models?: import("@converse/skeletor").ModelAttributes[], options?: import("@converse/skeletor").CollectionOptions<MUCMessage>);
    model: typeof MUCMessage;
    fetched: any;
}
import MUCMessage from './message.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=messages.d.ts.map