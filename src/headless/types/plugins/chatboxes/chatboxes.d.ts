export default ChatBoxes;
export type ChatBoxBase = import("../../shared/chatbox").default;
/**
 * @extends {Collection<ChatBoxBase>}
 */
declare class ChatBoxes extends Collection<import("../../shared/chatbox").default> {
    /**
     * @param {ChatBoxBase[]} models
     * @param {import('@converse/skeletor').CollectionOptions<ChatBoxBase>} options
     */
    constructor(models: ChatBoxBase[], options: import("@converse/skeletor").CollectionOptions<ChatBoxBase>);
    /**
     * @param {Collection} collection
     */
    onChatBoxesFetched(collection: Collection): void;
    /**
     * @param {boolean} reconnecting
     */
    onConnected(reconnecting: boolean): void;
    /**
     * @param {import('./types').CreateModelAttributes} attrs
     * @param {import('@converse/skeletor/dist/skeletor.d').ModelOptions} options
     */
    createModel(attrs: import("./types").CreateModelAttributes, options: import("@converse/skeletor/dist/skeletor.d").ModelOptions): any;
}
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=chatboxes.d.ts.map