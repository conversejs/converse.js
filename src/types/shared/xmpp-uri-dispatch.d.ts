/**
 * Perform the in-app action for an `xmpp:` URI (XEP-0147). No-op (returns false)
 * for a URI whose action we don't handle. Errors are logged, never thrown.
 * @param {string} href
 * @returns {Promise<boolean>} Whether the URI was handled.
 */
export function dispatchXMPPURI(href: string): Promise<boolean>;
//# sourceMappingURL=xmpp-uri-dispatch.d.ts.map