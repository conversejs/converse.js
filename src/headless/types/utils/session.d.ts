/**
 * We distinguish between UniView and MultiView instances.
 *
 * UniView means that only one chat is visible, even though there might be multiple ongoing chats.
 * MultiView means that multiple chats may be visible simultaneously.
 */
export function isUniView(): boolean;
export function isTestEnv(): boolean;
export function getUnloadEvent(): "pagehide" | "beforeunload" | "unload";
export function replacePromise(name: any): void;
export function shouldClearCache(): any;
export function tearDown(): Promise<{
    initialize(): void;
    VERSION_NAME: string;
    strict_plugin_dependencies: boolean;
    pluggable: any;
    templates: {};
    storage: {};
    promises: {
        initialized: any;
    };
    DEFAULT_IMAGE_TYPE: string;
    DEFAULT_IMAGE: string;
    NUM_PREKEYS: number;
    TIMEOUTS: {
        PAUSED: number;
        INACTIVE: number;
    };
    api: any;
    labels: Record<string, string | Record<string, string>>;
    exports: Record<string, any>;
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
}>;
export function clearSession(): any;
//# sourceMappingURL=session.d.ts.map