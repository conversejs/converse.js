export default bookmarks_api;
declare namespace bookmarks_api {
    export { bookmarks };
}
declare namespace bookmarks {
    /**
     * Calling this function will result in an IQ stanza being sent out to set
     * the bookmark on the server.
     *
     * @method api.bookmarks.set
     * @param {import('./types').BookmarkAttrs} attrs - The room attributes
     * @param {boolean} create=true - Whether the bookmark should be created if it doesn't exist
     * @returns {Promise<import('./model').default>}
     */
    function set(attrs: import("./types").BookmarkAttrs, create?: boolean): Promise<import("./model").default>;
    /**
     * @method api.bookmarks.get
     * @param {string} jid - The JID of the bookmark to return.
     * @returns {Promise<import('./model').default>}
     */
    function get(jid: string): Promise<import("./model").default>;
}
//# sourceMappingURL=api.d.ts.map