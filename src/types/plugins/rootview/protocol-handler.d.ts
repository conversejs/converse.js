/**
 * The `xmpp:` URI that will be acted on once logged in, if any: from a
 * shareable link to this page or from the browser's protocol handler.
 * @returns {import('./types').PendingXMPPURI|null}
 */
export function getPendingXMPPURI(): import("./types").PendingXMPPURI | null;
/**
 * Take the link the page was opened with as the pending one, if any. Called
 * when Converse is initialized, so a link is shown before login.
 */
export function initPendingXMPPURI(): void;
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
export function registerProtocolHandler(): boolean;
/**
 * `connected` handler: claim the `xmpp:` scheme, but only if the integrator
 * asked for it. Claiming a browser-wide scheme unprompted is not something an
 * embedded Converse has any business doing.
 */
export function registerProtocolHandlerIfEnabled(): void;
/**
 * Whether the current hash is an `xmpp:` link waiting to be handled (it is
 * left in place until there's a live connection), so that nothing else, such
 * as the Chat app mirroring its foreground conversation, overwrites it first.
 * @returns {boolean}
 */
export function isWaitingXMPPLink(): boolean;
/**
 * `hashchange`/`connected` handler: perform the XEP-0147 query action that an
 * incoming `xmpp:` URI names.
 *
 * Dispatch waits for a live connection. A cold click on an `xmpp:` link lands
 * here before login, and the chat and roster actions (along with their confirm
 * prompts) only mean anything against a live session. Until then the URI is
 * kept as the pending one (see {@link getPendingXMPPURI}), and the hash is left
 * in place so that a reload doesn't lose it either. The `connected` handler
 * then picks it up instead of it being silently dropped.
 *
 * The hash is dropped before dispatching, not after: with URL routing on,
 * opening the conversation pushes the chat's own route, which clearing
 * afterwards would wipe before the router gets to it.
 *
 * A link that arrives while another is being handled (e.g. during its confirm
 * prompt) waits in the hash and is handled next.
 *
 * @returns {Promise<boolean>} Whether the URI was handled.
 */
export function routeXMPPURI(): Promise<boolean>;
/**
 * The hash the protocol handler hands the URI back on. Must stay in sync with
 * the `protocol_handlers` entry in manifest.json.
 */
export const ACTION_HASH_PREFIX: "#converse/action?uri=";
//# sourceMappingURL=protocol-handler.d.ts.map