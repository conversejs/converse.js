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
 * @param {string} href
 * @returns {boolean}
 */
export function isHandledXMPPURI(href: string): boolean;
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
export const HANDLED_ACTIONS: string[];
//# sourceMappingURL=xmpp-uri.d.ts.map