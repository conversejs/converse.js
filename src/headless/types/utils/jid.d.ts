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
//# sourceMappingURL=jid.d.ts.map