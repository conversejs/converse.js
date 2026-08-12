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
export function routeXMPPURI(): Promise<boolean>;
/**
 * The hash the protocol handler hands the URI back on. Must stay in sync with
 * the `protocol_handlers` entry in manifest.json.
 */
export const ACTION_HASH_PREFIX: "#converse/action?uri=";
//# sourceMappingURL=protocol-handler.d.ts.map