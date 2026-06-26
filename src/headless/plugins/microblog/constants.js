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
 * Disco feature advertised by clients that understand the modern PubSub Social
 * Feed (XEP-0472).
 */
export const SOCIAL_FEED_FEATURE = 'urn:xmpp:pubsub-social-feed:1';

/**
 * Node configuration for our own social feed node, sent as XEP-0060
 * publish-options. This is the XEP-0472 "Base profile" config.
 */
export const MICROBLOG_PUBLISH_OPTIONS = {
    persist_items: 'true',
    max_items: 'max',
    send_last_published_item: 'never',
    notify_retract: 'true',
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
