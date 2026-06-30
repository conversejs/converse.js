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
         * Whether a JID can be followed, i.e. it advertises a XEP-0472 social
         * feed (`urn:xmpp:pubsub-social-feed:1`).
         *
         * A social feed is advertised in a client's per-resource XEP-0115 entity
         * caps, not on the bare-JID account disco#info, so we resolve the feature
         * against the contact's resources (full JIDs).
         *
         * @method _converse.api.microblog.canFollow
         * @param {string} jid
         * @returns {Promise<boolean>}
         */
        function canFollow(jid: string): Promise<boolean>;
        /**
         * Discover roster contacts that can be followed but aren't yet — the
         * union of two sources, minus contacts already followed or snoozed:
         *  1. the cheap online path: contacts whose live resources advertise a
         *     XEP-0472 social feed ({@link canFollow}); and
         *  2. verdicts learned by the manual {@link scanFollowable} sweep, read
         *     from the persistent followable cache (covers offline contacts).
         *
         * No network is used here: (1) reads cached entity caps and (2) reads
         * the local cache, so it's safe to recompute on roster/presence/cache
         * changes. The explicit sweep is what issues the probes.
         * @method _converse.api.microblog.discoverFollowable
         * @returns {Promise<string[]>} The bare JIDs of followable contacts.
         */
        function discoverFollowable(): Promise<string[]>;
        /**
         * Probe roster contacts' microblog nodes to discover followable feeds,
         * including OFFLINE contacts that {@link discoverFollowable}'s cheap path
         * can't see (it only reads online resources' caps). An explicit,
         * user-initiated sweep: it targets every saved, not-yet-followed contact
         * without a fresh cached verdict, probes each `urn:xmpp:microblog:0` node
         * with bounded concurrency, and caches each verdict so re-scans are cheap.
         * (A contact whose node isn't readable simply caches as not-followable.)
         *
         * @method _converse.api.microblog.scanFollowable
         * @param {object} [opts]
         * @param {(p: {scanned: number, total: number, found: number}) => void} [opts.onProgress]
         * @param {AbortSignal} [opts.signal] - Abort to stop launching further probes.
         * @returns {Promise<string[]>} The bare JIDs found followable in this sweep.
         */
        function scanFollowable({ onProgress, signal }?: {
            onProgress?: (p: {
                scanned: number;
                total: number;
                found: number;
            }) => void;
            signal?: AbortSignal;
        }): Promise<string[]>;
        /**
         * Follow a a social feed and record it in the durable XEP-0330 list.
         * Subscribe for live delivery (XEP-0472) and create + backfill the feed.
         *
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
         * Follow several feeds in sequence (see {@link follow}). Sequential
         * rather than parallel so we don't fire N publish+subscribe+backfill
         * bursts at the server at once. Never rejects: each entry's outcome is
         * reported in the returned array, so one failure doesn't abort the rest.
         *
         * @method _converse.api.microblog.followMany
         * @param {string[]} jids - The bare JIDs to follow.
         * @returns {Promise<Array<{ jid: string, ok: boolean, error?: Error }>>}
         */
        function followMany(jids: string[]): Promise<Array<{
            jid: string;
            ok: boolean;
            error?: Error;
        }>>;
        /**
         * Unfollow a contact's social feed: retract the XEP-0330 item, unsubscribe
         * to stop live delivery and drop the local feed and its cached posts.
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
         * Materialise the feeds the user reads and backfill them.
         * Idempotent, so the Social UI can call it whenever it opens.
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