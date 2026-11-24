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
import { api, log, u } from '@converse/headless';

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
export function decodeValue(s) {
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
    // RFC-5122 doesn't allow `=` in a querytype, so a first part holding one is
    // already a key-value pair of an action-less query, like the OMEMO
    // fingerprints in `xmpp:romeo@montague.lit?omemo-sid-123=abc` that
    // Conversations shares.
    const action = parts[0].includes('=') ? null : parts.shift() || null;
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
 * Invitation pages (easy-xmpp-invitation) that carry an `xmpp:` URI, minus its
 * scheme, in the fragment: `https://xmpp.link/#room@muc.example.org?join`.
 * Other clients hand these out because an https link works where `xmpp:` isn't
 * clickable, but a Converse user already has the client the page would send
 * them off to install.
 */
export const INVITATION_FRAGMENT_HOSTS = ['xmpp.link', 'invite.joinjabber.org', 'i.kaidan.im'];

// Converse's own hash routes (`#converse/chat/...`, `#converse?loglevel=...`).
const CONVERSE_ROUTE = /^converse([/?]|$)/;

/**
 * The `xmpp:` URI an invitation page carries in its fragment, or null when
 * the fragment is empty or one of Converse's own `#converse/...` routes.
 * @param {string} hash - A URL's fragment, with or without its `#`.
 * @returns {string|null}
 */
export function fragmentToXMPPURI(hash) {
    const fragment = hash.replace(/^#/, '');
    if (CONVERSE_ROUTE.test(fragment)) return null;

    // Conversations form-encodes the whole URI into the fragment (`@` as
    // `%40`, a space as `+`), so its own escapes arrive doubled, while Kaidan
    // (and Converse) write the URI in as is. A literal `@` or `?` can only be
    // the latter, which must not be decoded here, or an escaped `;` in a value
    // would become a separator and a `+` in a JID a space.
    const is_encoded = !fragment.includes('@') && !fragment.includes('?');
    const uri = (is_encoded ? decodeValue(fragment.replaceAll('+', ' ')) : fragment).replace(/^xmpp:/i, '');
    return uri ? `xmpp:${uri}` : null;
}

/**
 * Conversations' older invitation format, with the JID as a path segment:
 * `/i/<jid>` for a contact and `/j/<jid>` for a groupchat.
 */
export const INVITATION_PATH_HOST = 'conversations.im';

/**
 * The `xmpp:` URI an https invitation link stands for, or null when the link
 * isn't one. Mirrors how Conversations reads the same links.
 * @param {URL} url
 * @returns {string|null}
 */
export function invitationToXMPPURI(url) {
    // Our own links, on whichever page `shareable_link_url` names. Matched on
    // origin, so a deployment on plain http (a local one) is recognised too.
    const base = getShareableLinkBase();
    if (base && url.origin === base.origin && url.pathname === base.pathname) {
        return fragmentToXMPPURI(url.hash);
    }

    if (url.protocol !== 'https:') return null;

    const host = url.hostname.toLowerCase();
    if (INVITATION_FRAGMENT_HOSTS.includes(host)) {
        return url.pathname === '/' ? fragmentToXMPPURI(url.hash) : null;
    }
    if (host === INVITATION_PATH_HOST) {
        const m = url.pathname.match(/^\/([ij])\/([^/]+)$/);
        if (!m) return null;

        return jidSegmentToXMPPURI(m[2], m[1] === 'j');
    }
    return null;
}

/**
 * The `xmpp:` URI for a percent-encoded segment that names a JID and nothing
 * else (a Conversations `/i/` or `/j/` path, a legacy `#converse/chat?jid=`
 * fragment), or null when the segment has a malformed `%` sequence.
 *
 * A decoded `?` or `#` is part of the JID, so it is escaped again rather than
 * starting a query that picks the action or a fragment that cuts the JID short.
 * Whether the JID is one we can act on is left to {@link isHandledXMPPURI}.
 *
 * @param {string} segment
 * @param {boolean} [join=false] Whether it names a groupchat to join, not a contact.
 * @returns {string|null}
 */
export function jidSegmentToXMPPURI(segment, join = false) {
    let jid;
    try {
        jid = decodeURIComponent(segment);
    } catch {
        return null;
    }
    const escaped = jid.replace(/[%?#]/g, encodeURIComponent);
    return join ? `xmpp:${escaped}?join` : `xmpp:${escaped}`;
}

const DOMAINPART = /^(?:\[[\d.:a-f]+\]|(?:[\d.a-z-]|\P{ASCII})+)$/iu;

/**
 * Whether a JID's domainpart is one RFC 7622 § 3.2 allows: an IP literal, or a
 * hostname whose ASCII characters are letters, digits, `-` and `.` (non-ASCII
 * ones are left to IDNA). `u.isValidJID` only checks the `@` and `/` structure,
 * so without this `romeo@montague.lit?remove` would pass.
 * @param {string} jid
 * @returns {boolean}
 */
function hasValidDomainpart(jid) {
    const bare = jid.split('/')[0];
    return DOMAINPART.test(bare.slice(bare.lastIndexOf('@') + 1));
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
    return u.isValidJID(jid) && hasValidDomainpart(jid) && HANDLED_ACTIONS.includes(action ?? DEFAULT_ACTION);
}

/**
 * The `shareable_link_url` setting as a URL, or null when shareable links are
 * turned off (or the setting isn't a URL).
 * @returns {URL|null}
 */
function getShareableLinkBase() {
    const base = api.settings.get('shareable_link_url');
    if (!base) return null;

    try {
        return new URL(base);
    } catch {
        log.warn(`shareable_link_url is not a URL: ${base}`);
        return null;
    }
}

/**
 * An https link that invites whoever opens it to chat with `jid` (or, with
 * `join`, to join the groupchat `jid`), for places where an `xmpp:` URI isn't
 * clickable. Null when shareable links are turned off.
 *
 * The JID goes in the fragment, as xmpp.link does it, so the server hosting
 * the page never sees it. It's written raw, except for the characters that
 * would end the JID early or be decoded twice.
 *
 * @param {string} jid
 * @param {{ join?: boolean }} [options]
 * @returns {string|null}
 */
export function getShareableLink(jid, { join = false } = {}) {
    const base = getShareableLinkBase();
    if (!base) return null;

    const escaped = jid.replace(/[%?#]/g, encodeURIComponent);
    return `${base.origin}${base.pathname}${base.search}#${escaped}${join ? '?join' : ''}`;
}
