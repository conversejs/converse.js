export default api;
export type _converse = import("../_converse.js").ConversePrivateGlobal;
export type APIEndpoint = any;
/**
 * :shared-api.APIEndpoint
 */
export type module = Record<string, Function>;
/**
 * ### The private API
 *
 * The private API methods are only accessible via the closured {@link _converse}
 * object, which is only available to plugins.
 *
 * These methods are kept private (i.e. not global) because they may return
 * sensitive data which should be kept off-limits to other 3rd-party scripts
 * that might be running in the page.
 */
export type APINamespace = Record<string, APIEndpoint | Function>;
/**
 * ### The private API
 *
 * The private API methods are only accessible via the closured {@link _converse}
 * object, which is only available to plugins.
 *
 * These methods are kept private (i.e. not global) because they may return
 * sensitive data which should be kept off-limits to other 3rd-party scripts
 * that might be running in the page.
 */
export type API = Record<string, APINamespace | APIEndpoint | Function>;
/**
 * ### The private API
 *
 * The private API methods are only accessible via the closured {@link _converse}
 * object, which is only available to plugins.
 *
 * These methods are kept private (i.e. not global) because they may return
 * sensitive data which should be kept off-limits to other 3rd-party scripts
 * that might be running in the page.
 *
 * @memberOf _converse
 * @namespace api
 * @typedef {Record<string, Function>} module:shared-api.APIEndpoint
 * @typedef {Record<string, APIEndpoint|Function>} APINamespace
 * @typedef {Record<string, APINamespace|APIEndpoint|Function>} API
 * @type {API}
 */
declare const api: API;
//# sourceMappingURL=index.d.ts.map