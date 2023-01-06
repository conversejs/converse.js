declare namespace _default {
    /**
     * @method api.chats.create
     * @param { String|String[] } jids - A JID or array of JIDs
     * @param { Object } [attrs] An object containing configuration attributes
     * @param { Model } model - The type of chatbox that should be created
     */
    function create(jids: string | string[], attrs?: any, model: Model): Promise<any>;
    /**
     * @method api.chats.get
     * @param { String|String[] } jids - A JID or array of JIDs
     */
    function get(jids: string | string[]): Promise<any>;
}
export default _default;
