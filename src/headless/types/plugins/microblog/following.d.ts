/**
 * Compute the XEP-0330 item id for a subscription: the lowercase-hex SHA-1 of
 * `server + '<' + node + '<' + own-bare-jid`. This matches Movim's `generateId`
 * and the spec's publish/retract examples (e.g. `pubsub.shakespeare.lit<party<romeo@montague.lit`
 * → `0bc0e76c…`). The spec's separate "Generation Example" is erroneous — it
 * omits the jid — so we follow the prose algorithm and Movim instead.
 * @param {string} server - The followed entity's pubsub service.
 * @param {string} node - The followed node.
 * @param {string} jid - The follower's bare JID.
 * @returns {Promise<string>}
 */
export function computeFollowItemId(server: string, node: string, jid: string): Promise<string>;
/**
 * Build a XEP-0330 follow-list `<item>`.
 * @param {{ server: string, node: string, id: string, title?: string }} attrs
 * @returns {import('strophe.js').Stanza}
 */
export function buildFollowItem({ server, node, id, title }: {
    server: string;
    node: string;
    id: string;
    title?: string;
}): import("strophe.js").Stanza;
/**
 * Parse a XEP-0330 follow-list `<item>` into a plain object.
 * @param {Element} item
 * @returns {{ server: string, node: string, title?: string }|null}
 */
export function parseFollowItem(item: Element): {
    server: string;
    node: string;
    title?: string;
} | null;
/**
 * Publish (add or update) a follow to the durable XEP-0330 list on our own PEP
 * service.
 * @param {string} server - The followed entity's pubsub service (a contact's bare JID for PEP).
 * @param {string} node - The followed node (e.g. `urn:xmpp:microblog:0`).
 * @param {string} [title] - A human-readable label.
 * @returns {Promise<void>}
 */
export function publishFollow(server: string, node: string, title?: string): Promise<void>;
/**
 * Retract a follow from the XEP-0330 list.
 * @param {string} server
 * @param {string} node
 * @returns {Promise<void>}
 */
export function retractFollow(server: string, node: string): Promise<void>;
/**
 * Read the durable XEP-0330 follow list from our own PEP service.
 * @returns {Promise<Array<{ server: string, node: string, title?: string }>>}
 */
export function readFollowing(): Promise<Array<{
    server: string;
    node: string;
    title?: string;
}>>;
//# sourceMappingURL=following.d.ts.map