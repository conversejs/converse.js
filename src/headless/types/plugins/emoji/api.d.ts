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