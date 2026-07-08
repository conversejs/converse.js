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