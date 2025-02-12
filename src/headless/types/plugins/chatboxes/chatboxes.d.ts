export default ChatBoxes;
export type ChatBox = import("../../plugins/chat/model.js").default;
export type MUC = import("../../plugins/muc/muc").default;
export type Model = import("@converse/skeletor").Model;
declare class ChatBoxes extends Collection {
    /**
     * @param {Model[]} models
     * @param {object} options
     */
    constructor(models: Model[], options: object);
    /**
     * @param {Collection} collection
     */
    onChatBoxesFetched(collection: Collection): void;
    /**
     * @param {boolean} reconnecting
     */
    onConnected(reconnecting: boolean): void;
    /**
     * @param {object} attrs
     * @param {object} options
     */
    createModel(attrs: object, options: object): any;
}
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=chatboxes.d.ts.map