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
 *    live there and this module is only the transport.
 */
import { api, log } from '@converse/headless';
import { dispatchXMPPURI } from 'shared/xmpp-uri-dispatch.js';

/**
 * The hash the protocol handler hands the URI back on. Must stay in sync with
 * the `protocol_handlers` entry in manifest.json.
 */
export const ACTION_HASH_PREFIX = '#converse/action?uri=';

// Guards against `hashchange` and `connected` both dispatching the same URI.
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
 * The `xmpp:` URI the current hash carries, or null when it carries none.
 *
 * The URI is attacker-supplied (any page can link to this hash), so a malformed
 * percent-sequence is passed through rather than allowed to throw.
 *
 * @returns {string|null}
 */
function getURIFromHash() {
    if (!location.hash.startsWith(ACTION_HASH_PREFIX)) return null;

    const escaped = location.hash.slice(ACTION_HASH_PREFIX.length);
    if (!escaped) return null;

    try {
        return decodeURIComponent(escaped);
    } catch {
        return escaped;
    }
}

/** Drop the action hash, without a history entry and without firing `hashchange`. */
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
 * left in place until it has been handled, so the intent survives the login and
 * the `connected` handler picks it up instead of it being silently dropped.
 *
 * @returns {Promise<boolean>} Whether the URI was handled.
 */
export async function routeXMPPURI() {
    const uri = getURIFromHash();
    if (!uri || dispatching || !api.connection.connected()) return false;

    dispatching = true;
    try {
        return await dispatchXMPPURI(uri);
    } finally {
        dispatching = false;
        clearActionHash();
    }
}
