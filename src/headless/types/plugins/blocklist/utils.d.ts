/**
 * Sends an IQ stanza to remove one or more JIDs from the blocklist
 * @param {string|string[]} jid
 */
export function sendUnblockStanza(jid: string | string[]): Promise<void>;
/**
 * Sends an IQ stanza to add one or more JIDs from the blocklist
 * @param {string|string[]} jid
 */
export function sendBlockStanza(jid: string | string[]): Promise<void>;
//# sourceMappingURL=utils.d.ts.map