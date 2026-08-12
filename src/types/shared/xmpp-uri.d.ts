/**
 * The first value of a (possibly repeated) query key.
 * @param {string|string[]|undefined} v
 * @returns {string|undefined}
 */
export function firstValue(v: string | string[] | undefined): string | undefined;
/**
 * Parse an `xmpp:` URI into its JID, query action ("querytype"), and key-value
 * params. Repeated keys (e.g. `group`) collect into an array. Never throws.
 * @param {string} href
 * @returns {{ jid: string, action: string|null, params: Record<string, string|string[]> }}
 */
export function parseXMPPURI(href: string): {
    jid: string;
    action: string | null;
    params: Record<string, string | string[]>;
};
/**
 * Whether an `xmpp:` URI names an action the dispatcher handles (so the caller
 * attaches an in-app click handler instead of leaving it to the OS handler).
 *
 * Requiring a localpart is NOT a rule of RFC-5122 or XEP-0147. A domain-only JID
 * is perfectly valid and names a server, a service or a XEP-0100 gateway, and
 * URIs like `xmpp:irc.example.org?roster` are exactly how that registration flow
 * is meant to be triggered. It is a limitation of Converse: both the roster API
 * and chat creation (via `setModelContact` -> `api.contacts.add`) reject a JID
 * without a localpart, so a chat with a service silently never opens. Claiming
 * such a URI would swallow the click with `preventDefault()` and then do
 * nothing, which is worse than letting the OS pass it to a client that copes.
 *
 * @param {string} href
 * @returns {boolean}
 */
export function isHandledXMPPURI(href: string): boolean;
export const HANDLED_ACTIONS: string[];
/**
 * The action a query-less `xmpp:<jid>` implies. RFC-5122 gives a bare JID no
 * query action, but it identifies an entity, and "talk to this entity" is what
 * every client (and every user clicking one) takes that to mean.
 *
 * It matters that this is decided in one place: the same URI arrives both from a
 * link rendered in a message and from the OS protocol handler, and the two must
 * not disagree about what it does.
 */
export const DEFAULT_ACTION: "message";
//# sourceMappingURL=xmpp-uri.d.ts.map