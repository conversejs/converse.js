/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

/**
 * The PEP node on which a user's own microblog (XEP-0277) entries are published.
 */
export const MICROBLOG_NODE = 'urn:xmpp:microblog:0';

/**
 * Prefix of the per-post comments node. The full node name is
 * `urn:xmpp:microblog:0:comments/<post-id>` (XEP-0277 § Comments).
 */
export const COMMENTS_NODE_PREFIX = 'urn:xmpp:microblog:0:comments/';

/**
 * Node configuration for a post's comments node (XEP-0277 § Comments node
 * configuration), sent as XEP-0060 publish-options / node config. `access_model`
 * and `publish_model` are `open` so *anyone* can read and add a comment — the
 * author pre-creates the node when publishing the post, since a foreign
 * commenter can't create nodes on the author's PEP service.
 *
 * `deliver_payloads` is `true` for the same reasons as
 * {@link MICROBLOG_PUBLISH_OPTIONS}. XEP-0277 makes no recommendation either way
 * for comments nodes and XEP-0472's Base profile doesn't cover them, but Movim
 * configures them notification-only, so the fetch-on-header fallback matters here
 * too.
 */
export const COMMENTS_PUBLISH_OPTIONS = {
    access_model: 'open',
    publish_model: 'open',
    persist_items: 'true',
    max_items: 'max',
    send_last_published_item: 'never',
    notify_retract: 'true',
    deliver_payloads: 'true',
};

/**
 * Disco feature advertised by clients that understand the modern PubSub Social
 * Feed (XEP-0472).
 */
export const SOCIAL_FEED_FEATURE = 'urn:xmpp:pubsub-social-feed:1';

/**
 * A profile banner is not part of XEP-0277/0472. Movim publishes one to this PEP
 * node using the XEP-0084 User Avatar *metadata* format, but *by reference*:
 * an `<info url="…"/>` element (namespace {@link NS_AVATAR_METADATA}) pointing
 * at an HTTP-hosted image.
 */
export const MOVIM_BANNER_NODE = 'urn:xmpp:movim-banner:0';
export const NS_AVATAR_METADATA = 'urn:xmpp:avatar:metadata';

/**
 * Per-request IQ timeout (ms) for the best-effort banner fetch. Short (vs. the
 * 60s default) so a slow or unresponsive PEP service never leaves a banner IQ
 * hanging; the header just renders without a banner meanwhile.
 */
export const BANNER_FETCH_TIMEOUT = 10000;

/**
 * How many posts to fetch per page when backfilling a feed's history
 * (XEP-0060 § 6.5 Retrieve Items, `max_items` / RSM `max`).
 */
export const POSTS_PAGE_SIZE = 20;

/**
 * Ceiling for feeds on servers *without* RSM support. Without RSM we can't page
 * efficiently — native `max_items` only ever returns the newest N, so paging
 * backwards would re-fetch the whole set each time — so we load up to this many of
 * the newest posts in one query and don't offer "load older". A deliberate cap to
 * avoid an unbounded fetch on a busy feed.
 */
export const POSTS_MAX_WITHOUT_RSM = 200;

/**
 * How many contacts the manual "find people to follow" sweep probes at once. The
 * sweep is network-bound (waiting on IQ replies), so a modest pool keeps it quick
 * without flooding the connection.
 */
export const FOLLOWABLE_SCAN_CONCURRENCY = 10;

/**
 * Per-probe IQ timeout (ms) for the sweep. Much shorter than the default 60s
 * `stanza_timeout`, so a contact whose server never replies fails fast and frees
 * a worker instead of stalling the whole sweep.
 */
export const FOLLOWABLE_PROBE_TIMEOUT = 10000;

/**
 * How many nodes to request per RSM page when listing a service's nodes
 * (`api.microblog.browseFeeds`).
 */
export const BROWSE_PAGE_SIZE = 100;

/**
 * Node configuration for our own social feed node, sent as XEP-0060
 * publish-options. This is the XEP-0472 "Base profile" config, plus an open
 * access model.
 */
export const MICROBLOG_PUBLISH_OPTIONS = {
    access_model: 'open',
    persist_items: 'true',
    max_items: 'max',
    send_last_published_item: 'never',
    notify_retract: 'true',
    // `deliver_payloads` is a deliberate deviation: XEP-0472 § Base profile says it
    // SHOULD be `false` (subscribers get bare `<item id/>` headers and fetch the
    // content on demand). That requirement seems tailored towards a caching
    // server-side client like Movim.
    deliver_payloads: 'true',
};

/**
 * XEP-0330 (Pubsub Subscription): the PEP node holding the user's portable
 * follow-list (the durable source of truth for who they follow), and the
 * namespace of each list item's `<subscription>` payload.
 */
export const FOLLOWING_NODE = 'urn:xmpp:pubsub:subscription';
export const NS_SUBSCRIPTION = 'urn:xmpp:pubsub:subscription:0';

/**
 * Node configuration for the follow-list, sent as XEP-0060 publish-options.
 * Matches Movim's `generateConfig` so the same node interoperates: persistent,
 * presence-readable (contacts can discover who you follow), unbounded, and
 * notifying on retraction.
 */
export const FOLLOWING_PUBLISH_OPTIONS = {
    persist_items: 'true',
    access_model: 'presence',
    send_last_published_item: 'never',
    max_items: 'max',
    notify_retract: 'true',
};

// Atom (RFC 4287) and the syndication threading extension (RFC 4685) namespaces.
// Declared as plain constants (rather than read off `Strophe.NS`) so the parser
// is independent of plugin-initialization order.
export const NS_ATOM = 'http://www.w3.org/2005/Atom';
export const NS_THREAD = 'http://purl.org/syndication/thread/1.0';
export const NS_XHTML = 'http://www.w3.org/1999/xhtml';

/**
 * The Skeletor model `type` used by microblog posts, distinguishing them from
 * chat/groupchat/headline messages.
 */
export const MICROBLOG_TYPE = 'microblog';

/**
 * The text marker of a "like": a comment whose entry text is exactly this heart
 * (U+2665). Likes ride the per-post comments node as ♥-comments (XEP-0277
 * convention), so a single fetch of the node yields both comments and likes.
 */
export const LIKE_MARKER = '♥';

/**
 * How many per-post comment-summary fetches run concurrently (the greedy
 * on-visible fetch). Bounded so scrolling a long timeline doesn't flood the
 * connection; smaller than the followable sweep since these fire continuously as
 * posts scroll into view rather than as a one-shot burst.
 */
export const COMMENT_SUMMARY_CONCURRENCY = 4;
