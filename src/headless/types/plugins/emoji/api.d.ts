/**
 * Overrides how `emoji.json` is loaded. Registered by `shims/node-emoji.js`
 * under Node, where the file is read from the package rather than fetched from
 * the asset directory served next to the bundle.
 * @param {() => Promise<object>} loader
 */
export function setEmojiJSONLoader(loader: () => Promise<object>): void;
export default emojis_api;
declare namespace emojis_api {
    export { emojis };
}
declare namespace emojis {
    /**
     * Initializes Emoji support by downloading the emojis JSON (and any applicable images).
     * @method api.emojis.initialize
     * @returns {Promise}
     */
    function initialize(): Promise<any>;
}
//# sourceMappingURL=api.d.ts.map