/**
 * Build the `tag:` URI used as the Atom `<id>` of a new entry (RFC 4151).
 * @param {string} jid
 * @param {string} id
 * @returns {string}
 */
export function buildTagId(jid: string, id: string): string;
/**
 * @param {string} [node]
 * @returns {boolean}
 */
export function isMicroblogNode(node?: string): boolean;
/**
 * Handle an incoming PEP/PubSub event, routing microblog items to the relevant
 * feed. New feeds are auto-created only for the user's own PEP node; events from
 * other JIDs are applied only to feeds the user already follows (M3 adds the
 * machinery to follow others).
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