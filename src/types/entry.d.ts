export default converse;
export type Plugins = {
    [x: string]: object;
};
declare namespace converse {
    namespace plugins {
        /**
         * Adds a Converse plugin
         * @param {string} name The name of the plugin.
         * @param {object} plugin The plugin object to be added.
         * @throws {TypeError} If a plugin with the same name has already been registered.
         */
        function add(name: string, plugin: object): void;
    }
    /**
     * Initializes Converse with the provided settings.
     * @param {object} settings
     */
    function initialize(settings?: object): any;
    /**
     * Public API method which explicitly loads Converse and allows you the
     * possibility to pass in configuration settings which need to be defined
     * before loading. Currently this is only the
     * [assets_path](https://conversejs.org/docs/html/configuration.html#assets_path)
     * setting.
     *
     * If not called explicitly, this method will be called implicitly once
     * {@link converse.initialize} is called.
     *
     * In most cases, you probably don't need to explicitly call this method,
     * however, until converse.js has been loaded you won't have access to the
     * utility methods and globals exposed via {@link converse.env}. So if you
     * need to access `converse.env` outside of any plugins and before
     * `converse.initialize` has been called, then you need to call
     * `converse.load` first.
     *
     * @param {object} settings A map of configuration-settings that are needed at load time.
     * @example converse.load({assets_path: '/path/to/assets/'});
     */
    function load(settings?: object): {
        plugins: {
            /**
             * Adds a Converse plugin
             * @param {string} name The name of the plugin.
             * @param {object} plugin The plugin object to be added.
             * @throws {TypeError} If a plugin with the same name has already been registered.
             */
            add(name: string, plugin: object): void;
        };
        /**
         * Initializes Converse with the provided settings.
         * @param {object} settings
         */
        initialize(settings?: object): any;
        load(settings?: object): any;
    };
}
//# sourceMappingURL=entry.d.ts.map