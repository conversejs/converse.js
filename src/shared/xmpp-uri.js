/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Parse helpers for XEP-0147 (XMPP URI Scheme Query Components), plus the single
 * definition of which URIs Converse claims.
 *
 * The dispatch (which performs the action and shows confirmations) lives in ./xmpp-uri-dispatch.js.
 *
 * The RFC-5122 query syntax is `xmpp:<jid>?<action>;key=value;key2=value2` with
 * SEMICOLON-separated pairs, so `URLSearchParams` (which splits on `&`) must not be
 * used: it would swallow `?join;password=x` as a single `join;password` key.
 */
import { u } from '@converse/headless';

// The query actions the dispatcher handles. Any other `xmpp:` URI is left to the
// browser's default handler (a plain `target="_blank"` anchor).
export const HANDLED_ACTIONS = ['message', 'join', 'roster', 'subscribe', 'remove', 'unsubscribe'];

/**
 * The action a query-less `xmpp:<jid>` implies. RFC-5122 gives a bare JID no
 * query action, but it identifies an entity, and "talk to this entity" is what
 * every client (and every user clicking one) takes that to mean.
 *
 * It matters that this is decided in one place: the same URI arrives both from a
 * link rendered in a message and from the OS protocol handler, and the two must
 * not disagree about what it does.
 */
export const DEFAULT_ACTION = 'message';

/**
 * Decode one URI component, tolerating a malformed `%` sequence rather than throwing.
 * @param {string} s
 * @returns {string}
 */
function decodeValue(s) {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
}

/**
 * The first value of a (possibly repeated) query key.
 * @param {string|string[]|undefined} v
 * @returns {string|undefined}
 */
export function firstValue(v) {
    return Array.isArray(v) ? v[0] : v;
}

/**
 * Parse an `xmpp:` URI into its JID, query action ("querytype"), and key-value
 * params. Repeated keys (e.g. `group`) collect into an array. Never throws.
 * @param {string} href
 * @returns {{ jid: string, action: string|null, params: Record<string, string|string[]> }}
 */
export function parseXMPPURI(href) {
    let rest = String(href ?? '');
    if (rest.startsWith('xmpp:')) rest = rest.slice(5);

    const qi = rest.indexOf('?');
    const jid = decodeValue(qi === -1 ? rest : rest.slice(0, qi));
    const query = qi === -1 ? '' : rest.slice(qi + 1);
    if (!query) return { jid, action: null, params: {} };

    const parts = query.split(';');
    const action = parts.shift() || null;
    /** @type {Record<string, string|string[]>} */
    const params = {};
    for (const pair of parts) {
        if (!pair) continue;

        const eq = pair.indexOf('=');
        const key = decodeValue(eq === -1 ? pair : pair.slice(0, eq));
        const value = eq === -1 ? '' : decodeValue(pair.slice(eq + 1));
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            params[key] = [].concat(params[key], value);
        } else {
            params[key] = value;
        }
    }
    return { jid, action, params };
}

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
export function isHandledXMPPURI(href) {
    const { jid, action } = parseXMPPURI(href);
    return u.isValidJID(jid) && HANDLED_ACTIONS.includes(action ?? DEFAULT_ACTION);
}
