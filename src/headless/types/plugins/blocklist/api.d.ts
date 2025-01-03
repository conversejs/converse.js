export default blocklist_api;
declare namespace blocklist_api {
    export { blocklist };
}
declare namespace blocklist {
    /**
     * Retrieves the current user's blocklist
     * @returns {Promise<import('./collection').default>}
     */
    function get(): Promise<import("./collection").default>;
    /**
     * Adds a new entity to the blocklist
     * @param {string|string[]} jid
     * @param {boolean} [send_stanza=true]
     * @returns {Promise<import('./collection').default>}
     */
    function add(jid: string | string[], send_stanza?: boolean): Promise<import("./collection").default>;
    /**
     * Removes an entity from the blocklist
     * @param {string|string[]} jid
     * @param {boolean} [send_stanza=true]
     * @returns {Promise<import('./collection').default>}
     */
    function remove(jid: string | string[], send_stanza?: boolean): Promise<import("./collection").default>;
}
//# sourceMappingURL=api.d.ts.map