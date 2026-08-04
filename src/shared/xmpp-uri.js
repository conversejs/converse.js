/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Pure parse helpers for XEP-0147 (XMPP URI Scheme Query Components).
 *
 * The dispatch (which performs the action and shows confirmations) lives in ./xmpp-uri-dispatch.js.
 *
 * The RFC-5122 query syntax is `xmpp:<jid>?<action>;key=value;key2=value2` with
 * SEMICOLON-separated pairs, so `URLSearchParams` (which splits on `&`) must not be
 * used: it would swallow `?join;password=x` as a single `join;password` key.
 */

// The query actions the dispatcher handles. Any other `xmpp:` URI is left to the
// browser's default handler (a plain `target="_blank"` anchor).
export const HANDLED_ACTIONS = ['message', 'join', 'roster', 'subscribe', 'remove', 'unsubscribe'];

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
 * @param {string} href
 * @returns {boolean}
 */
export function isHandledXMPPURI(href) {
    const { jid, action } = parseXMPPURI(href);
    return !!jid && HANDLED_ACTIONS.includes(action);
}
