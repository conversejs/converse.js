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
        namespace profile {
            /**
             * Get (creating + caching if necessary) the profile model for an
             * author's JID. The person behind a feed (avatar, display name,
             * colour), resolved from the vCard cache like a post's author is.
             * Backs the Social app's profile view and works for non-contacts too.
             * @method _converse.api.microblog.profile.get
             * @param {string} jid - The author's (bare) JID.
             * @returns {import('./profile').default}
             */
            function get(jid: string): import("./profile").default;
            /**
             * Get a feed suitable for an author's profile view.
             *
             * When we follow the author (or it's our own), this is the *shared* feed
             * from {@link _converse.state.pubsubfeeds}. When we don't follow them,
             * it's a **detached**, browse-only feed that is deliberately *not* added
             * to that collection (it stays in-memory only). Either way the caller
             * should {@link PubSubFeed.fetchPosts} to backfill it.
             * @method _converse.api.microblog.profile.feed
             * @param {string} jid - The author's (bare) JID.
             * @param {string} [node=MICROBLOG_NODE]
             * @returns {Promise<import('./feed').default>}
             */
            function getFeed(jid: string, node?: string): Promise<import("./feed").default>;
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
         * Repeat (repost) a post into the user's own microblog feed (XEP-0277 §
         * Repeating a Post). Published to the user's own node and attributed to
         * the original author, so it renders with a "reposted by you" eyebrow.
         * @method _converse.api.microblog.repost
         * @param {import('./message').default} post - The post to repost.
         * @returns {Promise<void>}
         */
        function repost(post: import("./message").default): Promise<void>;
        /**
         * Like a post: publish a ♥ comment to the post's comments node.
         *
         * Optimistic: the like state flips immediately so that UI can update.
         * If the publish is refused the state is rolled back and the error
         * re-thrown for the caller to surface. A no-op if we already like it.
         * @method _converse.api.microblog.like
         * @param {import('./message').default} post
         * @returns {Promise<import('./message').default|undefined>} Our ♥ comment.
         */
        function like(post: import("./message").default): Promise<import("./message").default | undefined>;
        /**
         * Un-like a post: retract *every* ♥ of ours from the post's comments node
         * (duplicates can accrue across devices / cache resets, so one tap clears
         * the post regardless of how many accumulated).
         *
         * Optimistic: the like is removed and the count reverts immediately, then
         * the retracts are sent; if any is refused the like is restored and the
         * error re-thrown for the caller to surface. A no-op if we don't like it.
         * @method _converse.api.microblog.unlike
         * @param {import('./message').default} post
         * @returns {Promise<void>}
         */
        function unlike(post: import("./message").default): Promise<void>;
        namespace comments {
            /**
             * Get (creating it locally if necessary) the comments thread for a post.
             * The thread is a {@link CommentFeed} over the post's comments node,
             * kept out of the timeline aggregate.
             * @method _converse.api.microblog.comments.feed
             * @param {import('./message').default} post
             * @returns {Promise<import('./comment-feed').default|undefined>}
             */
            function feed(post: import("./message").default): Promise<import("./comment-feed").default | undefined>;
            /**
             * Fetch a post's comments into its thread and return the thread.
             * @method _converse.api.microblog.comments.fetch
             * @param {import('./message').default} post
             * @returns {Promise<import('./comment-feed').default|undefined>}
             */
            function fetch(post: import("./message").default): Promise<import("./comment-feed").default | undefined>;
            /**
             * Fetch a post's comments and denormalise the resulting counts onto
             * the post (see {@link syncCommentSummary}). This is the source for
             * the timeline's comment/like counts.
             * @method _converse.api.microblog.comments.fetchSummary
             * @param {import('./message').default} post
             * @returns {Promise<void>}
             */
            function fetchSummary(post: import("./message").default): Promise<void>;
            /**
             * Pin and subscribe to a post's comment thread so live comments/likes
             * route in and bump the post's denormalised counts. Used for our own
             * posts, so we take an explicit bare-JID subscription and
             * materialise (pin) the thread feed since `handleMicroblogEvent` routes a
             * comment event only into an already existing thread (create=false).
             * Idempotent; bounded by `social_max_pinned_threads`.
             * @method _converse.api.microblog.comments.pin
             * @param {import('./message').default} post
             * @returns {Promise<import('./comment-feed').default|undefined>}
             */
            function pin(post: import("./message").default): Promise<import("./comment-feed").default | undefined>;
            /**
             * Pin+subscribe the comment threads of our recent own posts (bounded
             * by `social_max_pinned_threads`) so live comments/likes on them keep
             * the counts current. Called on load; safe to call repeatedly.
             * @method _converse.api.microblog.comments.pinRecentOwn
             * @returns {Promise<void>}
             */
            function pinRecentOwn(): Promise<void>;
            /**
             * Add a comment to a post: publish an Atom entry, attributed to us,
             * to the post's comments node.
             * @method _converse.api.microblog.comments.add
             * @param {import('./message').default} post - The post being commented on.
             * @param {string} body - The comment text.
             * @returns {Promise<import('./message').default|undefined>}
             */
            function add(post: import("./message").default, body: string): Promise<import("./message").default | undefined>;
        }
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
         * Whether the user currently follows a JID + node, per the durable
         * XEP-0330 follow list (mirrored in `_converse.state.following`). This is
         * independent of whether a feed happens to be loaded for the JID — a
         * browse-only profile feed exists without a follow.
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