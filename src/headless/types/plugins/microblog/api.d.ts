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
        /**
         * Follow a contact's microblog: record it in the durable XEP-0330 list,
         * best-effort subscribe for live delivery, and create + backfill the feed.
         * @method _converse.api.microblog.follow
         * @param {string} jid - The followed entity's JID (a contact's bare JID).
         * @param {object} [options]
         * @param {string} [options.title] - A human-readable label for the follow.
         * @param {string} [options.node=MICROBLOG_NODE] - The node to follow.
         * @returns {Promise<import('./feed').default|undefined>}
         */
        function follow(jid: string, { title, node }?: {
            title?: string;
            node?: string;
        }): Promise<import("./feed").default | undefined>;
        /**
         * Unfollow a contact's microblog: retract the XEP-0330 item, best-effort
         * unsubscribe, and drop the local feed and its cached posts.
         * @method _converse.api.microblog.unfollow
         * @param {string} jid
         * @param {object} [options]
         * @param {string} [options.node=MICROBLOG_NODE]
         * @returns {Promise<void>}
         */
        function unfollow(jid: string, { node }?: {
            node?: string;
        }): Promise<void>;
        /**
         * Read the durable XEP-0330 follow list (the server-side source of truth
         * for who the user follows), e.g. for a Following list/count.
         * @method _converse.api.microblog.following
         * @returns {Promise<Array<{ server: string, node: string, title?: string }>>}
         */
        function following(): Promise<Array<{
            server: string;
            node: string;
            title?: string;
        }>>;
        /**
         * Materialise the feeds the user reads and backfill them — the own feed
         * plus a feed for every entry in the durable XEP-0330 follow list (which
         * also picks up follows made on other devices). Idempotent, so the Social
         * UI can call it whenever it opens.
         *
         * Deliberately *not* run on connect: the headless plugin stays passive so
         * it doesn't issue PEP queries for users who never open the Social app
         * (cached feeds already survive reconnects, so live PEP routing is
         * unaffected). The UI drives this instead.
         * @method _converse.api.microblog.initFollowing
         * @returns {Promise<void>}
         */
        function initFollowing(): Promise<void>;
        /**
         * Whether the user currently follows (has a feed for) a JID + node.
         * @method _converse.api.microblog.isFollowing
         * @param {string} jid
         * @param {string} [node=MICROBLOG_NODE]
         * @returns {boolean}
         */
        function isFollowing(jid: string, node?: string): boolean;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map