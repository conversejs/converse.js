export namespace user_settings_api {
    /**
     * Returns the user settings model. Useful when you want to listen for change events.
     * @async
     * @method _converse.api.user.settings.getModel
     * @returns {Promise<Model>}
     * @example const settings = await api.user.settings.getModel();
     */
    function getModel(): Promise<import("@converse/skeletor").Model>;
    /**
     * Get the value of a particular user setting.
     * @method _converse.api.user.settings.get
     * @param {string} key - The setting name
     * @param {*} [fallback] - An optional fallback value if the user setting is undefined
     * @returns {Promise} Promise which resolves with the value of the particular configuration setting.
     * @example api.user.settings.get("foo");
     */
    function get(key: string, fallback?: any): Promise<any>;
    /**
     * Set one or many user settings.
     * @async
     * @method _converse.api.user.settings.set
     * @param {Object|string} key An object containing config settings or alternatively a string key
     * @param {string} [val] The value, if the previous parameter is a key
     * @example api.user.settings.set("foo", "bar");
     * @example
     * api.user.settings.set({
     *     "foo": "bar",
     *     "baz": "buz"
     * });
     */
    function set(key: any, val?: string): Promise<any>;
    /**
     * Clears all the user settings
     * @async
     * @method api.user.settings.clear
     */
    function clear(): Promise<any>;
}
export type Model = import('@converse/skeletor').Model;
//# sourceMappingURL=api.d.ts.map