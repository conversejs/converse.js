/**
 * @param {string|null} [jid]
 * @returns {boolean}
 */
export function isValidJID(jid?: string | null): boolean;
/**
 * @param {string} jid
 * @returns {boolean}
 */
export function isValidMUCJID(jid: string): boolean;
/**
 * @param {string} jid1
 * @param {string} jid2
 * @returns {boolean}
 */
export function isSameBareJID(jid1: string, jid2: string): boolean;
/**
 * @param {string} jid1
 * @param {string} jid2
 * @returns {boolean}
 */
export function isSameDomain(jid1: string, jid2: string): boolean;
/**
 * @param {string} jid
 */
export function getJIDFromURI(jid: string): string;
/**
 * @param {string} jid
 * @param {boolean} [include_resource=false]
 * @returns {boolean}
 */
export function isOwnJID(jid: string, include_resource?: boolean): boolean;
/**
 * Appends locked_domain or default_domain to a JID if configured.
 * When locked_domain is set, it will:
 * - Strip the locked_domain if already present in the input
 * - Escape the username part using Strophe.escapeNode()
 * - Append the locked_domain
 * When default_domain is set and the input is not already a valid JID:
 * - Escape the username part using Strophe.escapeNode()
 * - Append the default_domain
 * @param {string} jid - The JID or username to process
 * @returns {string} The full JID with domain appended if applicable
 */
export function maybeAppendDomain(jid: string): string;
//# sourceMappingURL=jid.d.ts.map