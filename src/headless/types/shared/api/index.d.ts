export default api;
export type _converse = {
    initialize(): void;
    VERSION_NAME: string;
    strict_plugin_dependencies: boolean;
    pluggable: any;
    templates: {};
    storage: {};
    promises: {
        initialized: Promise<any> & {
            isResolved: boolean;
            isPending: boolean;
            isRejected: boolean;
            resolve: (value: any) => void;
            reject: (reason?: any) => void;
        };
    };
    NUM_PREKEYS: number;
    TIMEOUTS: {
        PAUSED: number;
        INACTIVE: number;
    };
    api: any;
    labels: Record<string, string | Record<string, string>>;
    exports: Record<string, any>;
    constants: Record<string, any>;
    state: any;
    initSession(): void;
    session: import("@converse/skeletor").Model;
    __(...args: string[]): any;
    ___(str: string): string;
    on(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any, context: any): any;
    _events: any;
    _listeners: {};
    listenTo(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any): any;
    _listeningTo: {};
    _listenId: any;
    off(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any, context?: any): any;
    stopListening(obj?: any, name?: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any): any;
    once(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any, context: any): any;
    listenToOnce(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any): any;
    trigger(name: string, ...args: any[]): any;
    constructor: Function;
    toString(): string;
    toLocaleString(): string;
    valueOf(): Object;
    hasOwnProperty(v: PropertyKey): boolean;
    isPrototypeOf(v: Object): boolean;
    propertyIsEnumerable(v: PropertyKey): boolean;
};
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