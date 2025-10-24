declare const Profile_base: {
    new (...args: any[]): {
        [x: string]: any;
        _vcard: import("../vcard/vcard.js").default;
        lazy_load_vcard: boolean;
        initialize(): void;
        readonly vcard: import("../vcard/vcard.js").default;
        getVCard(): Promise<import("../vcard/vcard.js").default | null>;
        _browserStorage?: import("@converse/skeletor").BrowserStorage;
        _changing: boolean;
        _pending: boolean | import("@converse/skeletor").ModelOptions;
        _previousAttributes?: import("@converse/skeletor").ModelAttributes;
        _url: string;
        _urlRoot: string;
        attributes: import("@converse/skeletor").ModelAttributes;
        changed: Partial<import("@converse/skeletor").ModelAttributes>;
        cid: string;
        collection?: import("@converse/skeletor").Collection;
        id: string | number;
        validationError: string | number | null;
        browserStorage: import("@converse/skeletor").BrowserStorage;
        readonly idAttribute: string;
        readonly cidPrefix: string;
        preinitialize(...args: any[]): void;
        validate(attrs: import("@converse/skeletor").ObjectWithId | Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions): string | number | null | void;
        defaults(): Partial<import("@converse/skeletor").ModelAttributes>;
        toJSON(): import("@converse/skeletor").ModelAttributes;
        sync(method: import("@converse/skeletor").SyncOperation, model: Model<any>, options: import("@converse/skeletor").Options): any;
        get<K extends string | number>(attr: K): import("@converse/skeletor").ModelAttributes[K];
        keys(): string[];
        values(): any[];
        pairs(): [string | number, any][];
        entries(): [string | number, any][];
        invert(): Record<string, string | number>;
        pick<K extends string | number>(...args: K[]): Pick<import("@converse/skeletor").ModelAttributes, K>;
        omit<K extends string | number>(...args: K[]): Omit<import("@converse/skeletor").ModelAttributes, K>;
        isEmpty(): boolean;
        has(attr: string | number): boolean;
        matches(attrs: Partial<import("@converse/skeletor").ModelAttributes>): boolean;
        set(key: string | import("@converse/skeletor").ObjectWithId | Partial<import("@converse/skeletor").ModelAttributes>, val?: any, options?: import("@converse/skeletor").ModelOptions): any;
        unset(attr: string | number, options?: import("@converse/skeletor").ModelOptions): any;
        clear(options?: import("@converse/skeletor").ModelOptions): any;
        hasChanged(attr?: string | number): boolean;
        changedAttributes(diff?: Partial<import("@converse/skeletor").ModelAttributes>): false | Partial<import("@converse/skeletor").ModelAttributes>;
        previous<K extends string | number>(attr: K): import("@converse/skeletor").ModelAttributes[K];
        previousAttributes(): import("@converse/skeletor").ModelAttributes;
        fetch(options?: import("@converse/skeletor").Options): any;
        save(key?: string | Partial<import("@converse/skeletor").ModelAttributes>, val?: any, options?: import("@converse/skeletor").ModelOptions): any;
        destroy(options?: import("@converse/skeletor").ModelOptions): any;
        urlRoot: string;
        url: string;
        parse(resp: any, options?: import("@converse/skeletor").ModelOptions): void | Partial<import("@converse/skeletor").ModelAttributes>;
        isNew(): boolean;
        isValid(options?: import("@converse/skeletor").ModelOptions): boolean;
        _validate(attrs: import("@converse/skeletor").ObjectWithId | Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions): boolean;
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
        constructor: Function;
        toString(): string;
        toLocaleString(): string;
        valueOf(): Object;
        hasOwnProperty(v: PropertyKey): boolean;
        isPrototypeOf(v: Object): boolean;
        propertyIsEnumerable(v: PropertyKey): boolean;
    };
} & {
    new (...args: any[]): {
        [x: string]: any;
        setColor(): Promise<void>;
        getIdentifier(): any;
        getColor(): Promise<string>;
        getAvatarStyle(append_style?: string): Promise<string>;
        _browserStorage?: import("@converse/skeletor").BrowserStorage;
        _changing: boolean;
        _pending: boolean | import("@converse/skeletor").ModelOptions;
        _previousAttributes?: import("@converse/skeletor").ModelAttributes;
        _url: string;
        _urlRoot: string;
        attributes: import("@converse/skeletor").ModelAttributes;
        changed: Partial<import("@converse/skeletor").ModelAttributes>;
        cid: string;
        collection?: import("@converse/skeletor").Collection;
        id: string | number;
        validationError: string | number | null;
        browserStorage: import("@converse/skeletor").BrowserStorage;
        readonly idAttribute: string;
        readonly cidPrefix: string;
        preinitialize(...args: any[]): void;
        initialize(attrs?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions): void;
        validate(attrs: import("@converse/skeletor").ObjectWithId | Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions): string | number | null | void;
        defaults(): Partial<import("@converse/skeletor").ModelAttributes>;
        toJSON(): import("@converse/skeletor").ModelAttributes;
        sync(method: import("@converse/skeletor").SyncOperation, model: Model<any>, options: import("@converse/skeletor").Options): any;
        get<K extends string | number>(attr: K): import("@converse/skeletor").ModelAttributes[K];
        keys(): string[];
        values(): any[];
        pairs(): [string | number, any][];
        entries(): [string | number, any][];
        invert(): Record<string, string | number>;
        pick<K extends string | number>(...args: K[]): Pick<import("@converse/skeletor").ModelAttributes, K>;
        omit<K extends string | number>(...args: K[]): Omit<import("@converse/skeletor").ModelAttributes, K>;
        isEmpty(): boolean;
        has(attr: string | number): boolean;
        matches(attrs: Partial<import("@converse/skeletor").ModelAttributes>): boolean;
        set(key: string | import("@converse/skeletor").ObjectWithId | Partial<import("@converse/skeletor").ModelAttributes>, val?: any, options?: import("@converse/skeletor").ModelOptions): any;
        unset(attr: string | number, options?: import("@converse/skeletor").ModelOptions): any;
        clear(options?: import("@converse/skeletor").ModelOptions): any;
        hasChanged(attr?: string | number): boolean;
        changedAttributes(diff?: Partial<import("@converse/skeletor").ModelAttributes>): false | Partial<import("@converse/skeletor").ModelAttributes>;
        previous<K extends string | number>(attr: K): import("@converse/skeletor").ModelAttributes[K];
        previousAttributes(): import("@converse/skeletor").ModelAttributes;
        fetch(options?: import("@converse/skeletor").Options): any;
        save(key?: string | Partial<import("@converse/skeletor").ModelAttributes>, val?: any, options?: import("@converse/skeletor").ModelOptions): any;
        destroy(options?: import("@converse/skeletor").ModelOptions): any;
        urlRoot: string;
        url: string;
        parse(resp: any, options?: import("@converse/skeletor").ModelOptions): void | Partial<import("@converse/skeletor").ModelAttributes>;
        isNew(): boolean;
        isValid(options?: import("@converse/skeletor").ModelOptions): boolean;
        _validate(attrs: import("@converse/skeletor").ObjectWithId | Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions): boolean;
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
        constructor: Function;
        toString(): string;
        toLocaleString(): string;
        valueOf(): Object;
        hasOwnProperty(v: PropertyKey): boolean;
        isPrototypeOf(v: Object): boolean;
        propertyIsEnumerable(v: PropertyKey): boolean;
    };
} & typeof Model;
export default class Profile extends Profile_base {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        presence: string;
        status: any;
        show: any;
        groups: any[];
    };
    /**
     * @return {import('./types').ConnectionStatus}
     */
    getStatus(): import("./types").ConnectionStatus;
    get(attr: any): any;
    /**
     * @param {string|Object} key
     * @param {string|Object} [val]
     * @param {Object} [options]
     */
    set(key: string | any, val?: string | any, options?: any): this;
    initialize(): void;
    /**
     * @param {import('../roster/types.js').ContactDisplayNameOptions} [options]
     */
    getDisplayName(options?: import("../roster/types.js").ContactDisplayNameOptions): any;
    getNickname(): any;
    /**
     * Constructs a presence stanza
     * @param {import('./types').PresenceAttrs} [attrs={}]
     * @returns {Promise<Stanza>}
     */
    constructPresence(attrs?: import("./types").PresenceAttrs): Promise<any>;
}
import { Model } from '@converse/skeletor';
export {};
//# sourceMappingURL=profile.d.ts.map