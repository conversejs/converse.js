/**
 * Build the `tag:` URI used as the Atom `<id>` of a new entry (RFC 4151).
 * @param {string} jid
 * @param {string} id
 * @returns {string}
 */
export function buildTagId(jid: string, id: string): string;
/**
 * Parse a feed address into a `{ jid, node }` pair, or null if it isn't a usable
 * address. Accepts either a bare JID (a user like `news@example.org` or a service
 * like `pubsub.example.org`), which defaults to the PEP microblog node, or an XMPP
 * pubsub URI carrying an explicit node (`xmpp:pubsub.example.org?;node=news`, per
 * RFC 5122 / XEP-0060).
 * @param {string} address
 * @returns {{ jid: string, node: string }|null}
 */
export function parseFeedAddress(address: string): {
    jid: string;
    node: string;
} | null;
/**
 * Handle an incoming PEP/PubSub event, routing items to the relevant feed. A feed
 * is auto-created only for the user's own microblog node; events from any other
 * node are applied only to a feed the user already follows (a contact's microblog
 * or an arbitrary community node on a pubsub service).
 *
 * @param {Element} message
 * @returns {boolean} Always `true`, to keep the Strophe handler registered.
 */
export function handleMicroblogEvent(message: Element): boolean;
/**
 * Register a handler for microblog items pushed via PEP from our own or
 * followed nodes.
 */
export function registerMicroblogHandler(): void;
//# sourceMappingURL=utils.d.ts.map