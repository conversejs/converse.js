declare namespace _default {
    /**
     * @method api.chatboxes.create
     * @param {string|string[]} jids - A JID or array of JIDs
     * @param {Object} attrs An object containing configuration attributes
     * @param {new (attrs: object, options: object) => ChatBox} model - The type of chatbox that should be created
     */
    function create(jids: string | string[], attrs: any, model: new (attrs: any, options: any) => import("../chat/model.js").default): Promise<import("../chat/model.js").default | import("../chat/model.js").default[]>;
    /**
     * @method api.chatboxes.get
     * @param {string|string[]} jids - A JID or array of JIDs
     */
    function get(jids: string | string[]): Promise<any>;
    namespace registry {
        /**
         * @method api.chatboxes.registry.add
         * Add another type of chatbox that can be added to this collection.
         * This is used in the `createModel` function to determine what type of
         * chatbox class to instantiate (e.g. ChatBox, MUC, Feed etc.) based on the
         * passed in attributes.
         * @param {string} type - The type name
         * @param {Model} model - The model which will be instantiated for the given type name.
         */
        function add(type: string, model: import("@converse/skeletor").Model): void;
        /**
         * @method api.chatboxes.registry.get
         * @param {string} type - The type name
         * @return {Model} model - The model which will be instantiated for the given type name.
         */
        function get(type: string): import("@converse/skeletor").Model;
    }
}
export default _default;
export type Model = import('@converse/skeletor').Model;
export type ChatBox = import('../chat/model.js').default;
//# sourceMappingURL=api.d.ts.map