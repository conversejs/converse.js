import type { Model } from '@converse/skeletor/src/model.d';

export namespace settings_api {
    /**
     * Allows new configuration settings to be specified, or new default values for
     * existing configuration settings to be specified.
     *
     * Note, calling this method *after* converse.initialize has been
     * called will *not* change the initialization settings provided via
     * `converse.initialize`.
     *
     * @method _converse.api.settings.extend
     * @param {object} settings The configuration settings
     * @example
     * _converse.api.settings.extend({
     *    'enable_foo': true
     * });
     *
     * // The user can then override the default value of the configuration setting when
     * // calling `converse.initialize`.
     * converse.initialize({
     *     'enable_foo': false
     * });
     */
    function extend(settings: any): void;
    function update(settings: any): void;
    /**
     * @method _converse.api.settings.get
     * @returns {*} Value of the particular configuration setting.
     * @example _converse.api.settings.get("play_sounds");
     */
    function get(key: any): any;
    /**
     * Set one or many configuration settings.
     *
     * Note, this is not an alternative to calling {@link converse.initialize}, which still needs
     * to be called. Generally, you'd use this method after Converse is already
     * running and you want to change the configuration on-the-fly.
     *
     * @method _converse.api.settings.set
     * @param {Object} [settings] An object containing configuration settings.
     * @param {string} [key] Alternatively to passing in an object, you can pass in a key and a value.
     * @param {string} [value]
     * @example _converse.api.settings.set("play_sounds", true);
     * @example
     * _converse.api.settings.set({
     *     "play_sounds": true,
     *     "hide_offline_users": true
     * });
     */
    function set(key: string, val: any): void;
    namespace listen {
        /**
         * Register an event listener for the passed in event.
         * @method _converse.api.settings.listen.on
         * @param { ('change') } name - The name of the event to listen for.
         *  Currently there is only the 'change' event.
         * @param { Function } handler - The event handler function
         * @param { Object } [context] - The context of the `this` attribute of the
         *  handler function.
         * @example _converse.api.settings.listen.on('change', callback);
         */
        function on(name: "change", handler: Function, context?: any): void;
        /**
         * To stop listening to an event, you can use the `not` method.
         * @method _converse.api.settings.listen.not
         * @param { String } name The event's name
         * @param { Function } callback The callback method that is to no longer be called when the event fires
         * @example _converse.api.settings.listen.not('change', callback);
         */
        function not(name: string, handler: any): void;
    }
}
export namespace user_settings_api {
    /**
     * Returns the user settings model. Useful when you want to listen for change events.
     * @async
     * @method _converse.api.user.settings.getModel
     * @returns {Promise<Model>}
     * @example const settings = await _converse.api.user.settings.getModel();
     */
    function getModel(): Promise<Model>;
    /**
     * Get the value of a particular user setting.
     * @method _converse.api.user.settings.get
     * @param {String} key - The setting name
     * @param {*} [fallback] - An optional fallback value if the user setting is undefined
     * @returns {Promise} Promise which resolves with the value of the particular configuration setting.
     * @example _converse.api.user.settings.get("foo");
     */
    function get(key: string, fallback?: any): Promise<any>;
    /**
     * Set one or many user settings.
     * @async
     * @method _converse.api.user.settings.set
     * @param {Object} [settings] An object containing configuration settings.
     * @param {string} [key] Alternatively to passing in an object, you can pass in a key and a value.
     * @param {string} [value]
     * @example _converse.api.user.settings.set("foo", "bar");
     * @example
     * _converse.api.user.settings.set({
     *     "foo": "bar",
     *     "baz": "buz"
     * });
     */
    function set(key: string, val: any): Promise<any>;
    /**
     * Clears all the user settings
     * @async
     * @method _converse.api.user.settings.clear
     */
    function clear(): Promise<any>;
}
