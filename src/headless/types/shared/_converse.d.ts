declare const ConversePrivateGlobal_base: (new (...args: any[]) => {
    [x: string]: any;
    _events?: import("@converse/skeletor").EventHandlersMap;
    _listeners?: import("@converse/skeletor").EventListenerMap;
    _listeningTo?: import("@converse/skeletor").EventListenerMap;
    _listenId?: string;
    on(name: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback | import("@converse/skeletor").EventContext, context?: import("@converse/skeletor").EventContext): any;
    listenTo(obj: import("@converse/skeletor").ObjectListenedTo, name: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback): any;
    off(name?: string | import("@converse/skeletor").EventCallbackMap | null, callback?: import("@converse/skeletor").EventCallback | import("@converse/skeletor").EventContext | null, context?: import("@converse/skeletor").EventContext): any;
    stopListening(obj?: any, name?: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback): any;
    once(name: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback | import("@converse/skeletor").EventContext, context?: import("@converse/skeletor").EventContext): any;
    listenToOnce(obj: any, name: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback): any;
    trigger(name: string, ...args: any[]): any;
}) & ObjectConstructor;
/**
 * A private, closured namespace containing the private api (via {@link _converse.api})
 * as well as private methods and internal data-structures.
 * @global
 * @namespace _converse
 */
export class ConversePrivateGlobal extends ConversePrivateGlobal_base {
    constructor();
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
    /**
     * Namespace for storing translated strings.
     *
     * @typedef {Record<string, string>} UserMessage
     * @typedef {Record<string, string|UserMessage>} UserMessages
     */
    labels: Record<string, string | Record<string, string>>;
    /**
     * Namespace for storing code that might be useful to 3rd party
     * plugins. We want to make it possible for 3rd party plugins to have
     * access to code (e.g. classes) from converse.js without having to add
     * converse.js as a dependency.
     */
    exports: Record<string, any>;
    /**
     * Provides a way for 3rd party plugins to access constants used by
     * Converse.
     */
    constants: Record<string, any>;
    /**
     * Utility methods and globals from bundled 3rd party libraries.
     */
    env: import("./api/types.js").ConverseEnv;
    /**
     * Namespace for storing the state, as represented by instances of
     * Models and Collections.
     *
     * @typedef {Object & Record<string, Collection|Model|VCards|Profile|DiscoState>} ConverseState
     * @property {VCards} [vcards]
     * @property {Profile} profile
     * @property {DiscoState} disco
     */
    state: any;
    initSession(): void;
    session: any;
    /**
     * Translate the given string based on the current locale.
     * @method __
     * @memberOf _converse
     * @param {...String} args
     */
    __(...args: string[]): any;
    /**
     * A no-op method which is used to signal to gettext that the passed in string
     * should be included in the pot translation file.
     *
     * In contrast to the double-underscore method, the triple underscore method
     * doesn't actually translate the strings.
     *
     * One reason for this method might be because we're using strings we cannot
     * send to the translation function because they require variable interpolation
     * and we don't yet have the variables at scan time.
     *
     * @method ___
     * @memberOf _converse
     * @param {String} str
     */
    ___(str: string): string;
}
export default _converse;
export type BrowserStorage = import("@converse/skeletor").BrowserStorage;
export type Collection = import("@converse/skeletor").Collection;
export type DiscoState = import("../plugins/disco/index").DiscoState;
export type Profile = import("../plugins/status/profile").default;
export type VCards = import("../plugins/vcard/vcard").default;
declare const _converse: ConversePrivateGlobal;
//# sourceMappingURL=_converse.d.ts.map