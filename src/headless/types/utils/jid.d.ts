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
 * Extract the `node` query parameter from an XMPP URI (RFC 5122),
 * e.g. `xmpp:romeo@montague.lit?;node=urn:xmpp:microblog:0;item=1` → `urn:xmpp:microblog:0`.
 * @param {string} [uri]
 * @returns {string|undefined}
 */
export function getNodeFromURI(uri?: string): string | undefined;
/**
 * Extract the `item` query parameter from an XMPP URI (RFC 5122),
 * e.g. `xmpp:romeo@montague.lit?;node=urn:xmpp:microblog:0;item=1` → `1`.
 * @param {string} [uri]
 * @returns {string|undefined}
 */
export function getItemFromURI(uri?: string): string | undefined;
/**
 * @param {string} jid
 * @param {boolean} [include_resource=false]
 * @returns {boolean}
 */
export function isOwnJID(jid: string, include_resource?: boolean): boolean;
/**
 * Resolves a JID to the full JID of the contact's highest-priority resource.
 *
 * Needed whenever a query has to reach the contact's client rather than their
 * server. An IQ addressed to a bare JID is answered by the server on their
 * behalf (RFC 6121 § 8.5.2), which is the wrong respondent for anything about
 * the person, such as XEP-0202 entity time.
 *
 * @param {string} jid - Bare or full; only the bare part is used to look up
 * @returns {string|null}
 */
export function getFullJID(jid: string): string | null;
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