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
 * Read a durable XEP-0330 follow list. Defaults to our own PEP service; pass a
 * JID to read a contact's list instead (their node is `access_model=presence`,
 * so this succeeds for contacts with presence access and is refused otherwise).
 * @param {string} [jid=null] - Whose list to read; null/own for our own.
 * @returns {Promise<Array<{ server: string, node: string, title?: string }>>}
 */
export function readFollowing(jid?: string): Promise<Array<{
    server: string;
    node: string;
    title?: string;
}>>;
//# sourceMappingURL=following.d.ts.map