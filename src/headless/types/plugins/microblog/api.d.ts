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
            /**
             * The detached browse feeds cached this session. Feeds the user
             * looked at (e.g. via an author's profile) without following them.
             * @method _converse.api.microblog.feeds.browsed
             * @returns {import('./feed').default[]}
             */
            function browsed(): import("./feed").default[];
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
             * to that collection (it stays in-memory only), but cached for the
             * session (see {@link PubSubFeed.getBrowseFeed}) so re-visits are warm.
             * Either way the caller should {@link PubSubFeed.fetchPosts} to backfill it.
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
         * Parse a feed address into a `{ jid, node }` pair, or null if it isn't a
         * usable address. Accepts a bare JID (a user or a pubsub service, which
         * defaults to the PEP microblog node) or an XMPP pubsub URI carrying an
         * explicit node (`xmpp:pubsub.example.org?;node=news`). Exposed so the
         * "Follow a feed" UI can validate and preview input as it's typed.
         * @method _converse.api.microblog.parseFeedAddress
         * @param {string} address
         * @returns {{ jid: string, node: string }|null}
         */
        function parseFeedAddress(address: string): {
            jid: string;
            node: string;
        } | null;
        /**
         * Follow a feed given a free-form address (a bare JID or an XMPP pubsub
         * node URI), probing it first so an unreadable or missing node fails loudly
         * rather than adding an empty feed. This is the entry point for following
         * feeds that aren't roster contacts, e.g. a community or news node on a
         * pubsub service.
         *
         * @method _converse.api.microblog.followByAddress
         * @param {string} address - A bare JID or `xmpp:` pubsub URI.
         * @param {object} [options]
         * @param {string} [options.node] - Overrides the node parsed from the address.
         * @param {string} [options.title] - A human-readable label for the follow.
         * @returns {Promise<import('./feed').default|undefined>}
         * @throws {Error} named `InvalidFeedAddress` if the address can't be parsed,
         *      or `FeedNotFound` if the node has no readable feed.
         */
        function followByAddress(address: string, { node, title }?: {
            node?: string;
            title?: string;
        }): Promise<import("./feed").default | undefined>;
        /**
         * Browse one page of the feed nodes hosted on a PubSub service. Sends
         * disco#items to list the service's nodes (XEP-0060 § 5.5 Discover Nodes),
         * then probes each node's disco#info (§ 5.4 meta-data) with bounded
         * concurrency to learn its title, description, payload type and subscriber
         * count.
         *
         * A busy service returns its nodes one page at a time via XEP-0059 RSM, so
         * this fetches a single page and returns the server's `<last>` cursor plus
         * `has_more`; the caller pages by calling again with `after: cursor`. RSM is
         * the only standard way to bound a disco#items query, so a service without
         * it just returns its nodes in one unpaged batch (no cursor, `has_more`
         * false).
         *
         * @method _converse.api.microblog.browseFeeds
         * @param {string} service_jid - A pubsub service JID (or any JID that
         *      answers disco#items with a node list).
         * @param {object} [opts]
         * @param {string} [opts.after] - RSM cursor from a previous page's `cursor`
         *      (omit for the first page).
         * @param {number} [opts.max=BROWSE_PAGE_SIZE] - Page size (RSM `max`).
         * @param {(p: {probed: number, total: number}) => void} [opts.onProgress]
         * @param {AbortSignal} [opts.signal] - Abort to stop probing further nodes.
         * @returns {Promise<import('./types.ts').BrowseFeedsResult>}
         * @throws {Error} named `InvalidFeedAddress` if `service_jid` isn't usable.
         */
        function browseFeeds(service_jid: string, { after, max, onProgress, signal }?: {
            after?: string;
            max?: number;
            onProgress?: (p: {
                probed: number;
                total: number;
            }) => void;
            signal?: AbortSignal;
        }): Promise<import("./types.ts").BrowseFeedsResult>;
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
         * Like a post *or a comment*: publish a ♥ to the post's comments node,
         * pointing at the comment when the target is one (see {@link resolveLikeTarget}).
         *
         * Optimistic: the like state flips immediately so that UI can update.
         * If the publish is refused the state is rolled back and the error
         * re-thrown for the caller to surface. A no-op if we already like it.
         * @method _converse.api.microblog.like
         * @param {import('./message').default} target - A post or a comment.
         * @returns {Promise<import('./message').default|undefined>} Our ♥ item.
         */
        function like(target: import("./message").default): Promise<import("./message").default | undefined>;
        /**
         * Un-like a post *or a comment*: retract *every* ♥ of ours for that target
         * from the comments node (duplicates can accrue across devices / cache
         * resets, so one tap clears it regardless of how many accumulated).
         *
         * Optimistic: the like is removed and the count reverts immediately, then
         * the retracts are sent; if any is refused the like is restored and the
         * error re-thrown for the caller to surface. A no-op if we don't like it.
         * @method _converse.api.microblog.unlike
         * @param {import('./message').default} target - A post or a comment.
         * @returns {Promise<void>}
         */
        function unlike(target: import("./message").default): Promise<void>;
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
             * Fetch a post's comments into its thread and return the thread, then
             * denormalise each comment's own counts (see {@link syncCommentCounts})
             * so the drill-down view can show a reply/like tally per row.
             * @method _converse.api.microblog.comments.fetch
             * @param {import('./message').default} post
             * @returns {Promise<import('./comment-feed').default|undefined>}
             */
            function fetch(post: import("./message").default): Promise<import("./comment-feed").default | undefined>;
            /**
             * Resolve a focused item's direct replies to the feed that holds them,
             * fetching it. The drill-down view reads two shapes identically:
             *  - **null**: the flat model (ours / Movim / renostr). The item's
             *    replies are the items in its *own* thread node whose `in_reply_to`
             *    is this item, so the caller filters the thread it already has.
             *  - **a CommentFeed**: the Libervia node-per-comment model. The item
             *    advertised a dedicated replies node (see
             *    {@link PostComment.getRepliesRef}); its replies are that feed's
             *    top-level items.
             *
             * Only ever follows the *explicit* replies link, so a flat thread is
             * never probed. The child feed is an ordinary member of
             * `commentfeeds`, so LRU eviction, pinning and live routing all apply.
             * @method _converse.api.microblog.comments.replies
             * @param {import('./post-comment').default} item
             * @returns {Promise<import('./comment-feed').default|null>}
             */
            function replies(item: import("./post-comment").default): Promise<import("./comment-feed").default | null>;
            /**
             * Materialise and backfill a comments node by address, returning its
             * {@link CommentFeed}. The low-level primitive behind {@link replies}
             * and used to resolve a deep-linked Libervia child-node comment.
             * @method _converse.api.microblog.comments.thread
             * @param {string} jid - The comments service JID.
             * @param {string} node - The comments node.
             * @returns {Promise<import('./comment-feed').default|null>}
             */
            function thread(jid: string, node: string): Promise<import("./comment-feed").default | null>;
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
             * Add a comment to a post, or a threaded reply to one of its comments.
             * Publishes an Atom entry attributed to us into the post's comments
             * node; when `parent` is given, the entry carries a `<thr:in-reply-to>`
             * pointing at it (RFC 4685), so the whole thread stays in one node.
             * @method _converse.api.microblog.comments.add
             * @param {import('./message').default} post - The post that owns the thread.
             * @param {string} body - The comment text.
             * @param {object} [opts]
             * @param {import('./post-comment').default} [opts.parent] - The comment
             *      being replied to; omit for a direct comment on the post.
             * @returns {Promise<import('./message').default|undefined>}
             */
            function add(post: import("./message").default, body: string, { parent }?: {
                parent?: import("./post-comment").default;
            }): Promise<import("./message").default | undefined>;
        }
        /**
         * Read a durable XEP-0330 follow list (the server-side source of truth
         * for who an account follows), e.g. for a Following list/count. Defaults
         * to our own list; pass a JID to read a contact's (their node is
         * presence-access, so it succeeds for contacts and is refused otherwise).
         * @method _converse.api.microblog.following
         * @param {string} [jid=null] - Whose list to read; null/own for our own.
         * @returns {Promise<Array<{ server: string, node: string, title?: string }>>}
         */
        function following(jid?: string): Promise<Array<{
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
         * Re-read the durable XEP-0330 follow list from our own PEP service and
         * bring local state into line with it: reconcile the `following` mirror,
         * materialise and backfill any feed newly followed on another device or
         * client, and drop any feed unfollowed elsewhere. Only the delta is
         * touched (feeds we already follow are left as they are), and every step
         * is idempotent, so re-running it (e.g. on a `+notify` echo of our own
         * change) is a no-op.
         *
         * Driven by the `+notify` push on our follow-list node (see
         * `handleMicroblogEvent`), which is how a follow/unfollow made on one
         * device propagates live to the others.
         * @method _converse.api.microblog.syncFollowing
         * @returns {Promise<void>}
         */
        function syncFollowing(): Promise<void>;
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