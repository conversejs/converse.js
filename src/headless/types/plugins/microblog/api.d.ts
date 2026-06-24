declare namespace _default {
    namespace microblog {
        namespace feeds {
            /**
             * Get (creating if necessary) a microblog feed for a JID + node.
             * @method _converse.api.microblog.feeds.get
             * @param {string} [jid] - The feed's JID. Defaults to the logged-in
             *      user's bare JID (their own microblog).
             * @param {string} [node='urn:xmpp:microblog:0']
             * @param {boolean} [create=true]
             * @returns {Promise<import('./feed').default|undefined>}
             */
            function get(jid?: string, node?: string, create?: boolean): Promise<import("./feed").default | undefined>;
            /**
             * Get the logged-in user's own microblog feed.
             * @method _converse.api.microblog.feeds.own
             * @returns {Promise<import('./feed').default>}
             */
            function own(): Promise<import("./feed").default>;
        }
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map