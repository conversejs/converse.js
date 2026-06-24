/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
/**
 * The PEP node on which a user's own microblog (XEP-0277) entries are published.
 */
export const MICROBLOG_NODE: "urn:xmpp:microblog:0";
/**
 * Prefix of the per-post comments node. The full node name is
 * `urn:xmpp:microblog:0:comments/<post-id>` (XEP-0277 § Comments).
 */
export const COMMENTS_NODE_PREFIX: "urn:xmpp:microblog:0:comments/";
/**
 * Disco feature advertised by clients that understand the modern PubSub Social
 * Feed (XEP-0472).
 */
export const SOCIAL_FEED_FEATURE: "urn:xmpp:pubsub-social-feed:1";
export const NS_ATOM: "http://www.w3.org/2005/Atom";
export const NS_THREAD: "http://purl.org/syndication/thread/1.0";
export const NS_XHTML: "http://www.w3.org/1999/xhtml";
/**
 * The Skeletor model `type` used by microblog posts, distinguishing them from
 * chat/groupchat/headline messages.
 */
export const MICROBLOG_TYPE: "microblog";
//# sourceMappingURL=constants.d.ts.map