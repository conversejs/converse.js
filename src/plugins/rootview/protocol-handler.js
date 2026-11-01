/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Lets Converse act as the browser's handler for `xmpp:` links (XEP-0147), so
 * clicking one in a mail client, a document or another web page opens it here.
 *
 * Two halves:
 *
 *  - Registration. `manifest.json` declares a `protocol_handlers` entry, which
 *    covers Converse once it's installed as a PWA. {@link registerProtocolHandler}
 *    does the same at runtime for a plain browser tab (opt-in, see the
 *    `register_protocol_handler` setting).
 *  - Reception. The browser hands the URI back on the `#converse/action?uri=`
 *    hash, which {@link routeXMPPURI} unpacks and passes to the existing
 *    dispatcher in shared/xmpp-uri-dispatch.js. All the parsing, the confirm
 *    prompts for state-mutating actions and the set of supported query actions
 *    live there and this module is only the transport. The legacy
 *    `#converse/chat?jid=` and `#converse/room?jid=` deep links take the same
 *    path, read as the `xmpp:` URI they stand for.
 */
import { api, log } from '@converse/headless';
import { dispatchXMPPURI } from 'shared/xmpp-uri-dispatch.js';
import { decodeValue, isHandledXMPPURI, jidSegmentToXMPPURI } from 'shared/xmpp-uri.js';

/**
 * The hash the protocol handler hands the URI back on. Must stay in sync with
 * the `protocol_handlers` entry in manifest.json.
 */
export const ACTION_HASH_PREFIX = '#converse/action?uri=';

// Handles one link at a time, so their confirm prompts don't stack.
let dispatching = false;

/**
 * Ask the browser to route `xmpp:` links to this Converse instance.
 *
 * Browsers only accept this from a secure context with a same-origin URL, and
 * Firefox additionally requires a user gesture, so it's also exposed as
 * `api.protocolHandler.register()` for integrators who would rather prompt from
 * a button than on login. Never throws.
 *
 * @returns {boolean} Whether the browser accepted the call.
 */
export function registerProtocolHandler() {
    if (!('registerProtocolHandler' in navigator)) return false;

    try {
        navigator.registerProtocolHandler('xmpp', `${location.origin}${location.pathname}${ACTION_HASH_PREFIX}%s`);
        return true;
    } catch (e) {
        // Insecure context, a cross-origin URL, or (Firefox) no user gesture.
        log.warn(`Could not register the xmpp: protocol handler: ${e}`);
        return false;
    }
}

/**
 * `connected` handler: claim the `xmpp:` scheme, but only if the integrator
 * asked for it. Claiming a browser-wide scheme unprompted is not something an
 * embedded Converse has any business doing.
 */
export function registerProtocolHandlerIfEnabled() {
    if (api.settings.get('register_protocol_handler')) registerProtocolHandler();
}

/**
 * The legacy deep-link fragments (`#converse/chat?jid=<jid>` and
 * `#converse/room?jid=<jid>`), still accepted as an alias for the `xmpp:` URI
 * they stand for but never emitted.
 */
const LEGACY_HASH = /^#converse\/(chat|room)\?jid=([^&;]*)/;

/**
 * The `xmpp:` URI a legacy `?jid=` fragment stands for, or null when the
 * fragment isn't one or doesn't name a JID we can act on.
 * @param {string} hash
 * @returns {string|null}
 */
function legacyHashToXMPPURI(hash) {
    const m = hash.match(LEGACY_HASH);
    if (!m) return null;

    const uri = jidSegmentToXMPPURI(m[2], m[1] === 'room');
    return uri && isHandledXMPPURI(uri) ? uri : null;
}

/**
 * The `xmpp:` URI the current hash carries, or null when it carries none.
 *
 * The URI is attacker-supplied (any page can link to this hash), so a malformed
 * percent-sequence is passed through rather than allowed to throw.
 *
 * @returns {string|null}
 */
function getURIFromHash() {
    if (!location.hash.startsWith(ACTION_HASH_PREFIX)) return legacyHashToXMPPURI(location.hash);

    const escaped = location.hash.slice(ACTION_HASH_PREFIX.length);
    return escaped ? decodeValue(escaped) : null;
}

/**
 * Whether the current hash is an `xmpp:` link waiting to be handled (it is
 * left in place until there's a live connection), so that nothing else, such
 * as the Chat app mirroring its foreground conversation, overwrites it first.
 * @returns {boolean}
 */
export function isWaitingXMPPLink() {
    return getURIFromHash() !== null;
}

/** Drop the link from the hash, without a history entry and without firing `hashchange`. */
function clearActionHash() {
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
}

/**
 * `hashchange`/`connected` handler: perform the XEP-0147 query action that an
 * incoming `xmpp:` URI names.
 *
 * Dispatch waits for a live connection. A cold click on an `xmpp:` link lands
 * here before login, and the chat and roster actions (along with their confirm
 * prompts) only mean anything against a live session. The hash is deliberately
 * left in place until then, so the intent survives the login and the
 * `connected` handler picks it up instead of it being silently dropped.
 *
 * It's dropped before dispatching, not after: with URL routing on, opening the
 * conversation pushes the chat's own route, which clearing afterwards would
 * wipe before the router gets to it.
 *
 * A link that arrives while another is being handled (e.g. during its confirm
 * prompt) waits in the hash and is handled next.
 *
 * @returns {Promise<boolean>} Whether the URI was handled.
 */
export async function routeXMPPURI() {
    const uri = getURIFromHash();
    if (!uri || dispatching || !api.connection.connected()) return false;

    dispatching = true;
    clearActionHash();
    try {
        return await dispatchXMPPURI(uri);
    } finally {
        dispatching = false;
        if (getURIFromHash()) routeXMPPURI();
    }
}
