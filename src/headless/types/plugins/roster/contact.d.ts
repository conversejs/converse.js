export default RosterContact;
declare const RosterContact_base: {
    new (...args: any[]): {
        _vcard: import("../vcard/vcard.js").default;
        lazy_load_vcard: boolean;
        initialize(): void;
        readonly vcard: import("../vcard/vcard.js").default;
        getVCard(): Promise<import("../vcard/vcard.js").default | null>;
        cid: any;
        attributes: {};
        validationError: string;
        collection: any;
        changed: {};
        browserStorage: Storage;
        _browserStorage: Storage;
        readonly idAttribute: string;
        readonly cidPrefix: string;
        preinitialize(): void;
        validate(attrs: object, options?: object): string;
        toJSON(): any;
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: Model, options: import("@converse/skeletor/src/types/model.js").Options): any;
        get(attr: string): any;
        keys(): string[];
        values(): any[];
        pairs(): [string, any][];
        entries(): [string, any][];
        invert(): any;
        pick(...args: any[]): any;
        omit(...args: any[]): any;
        isEmpty(): any;
        has(attr: string): boolean;
        matches(attrs: import("@converse/skeletor/src/types/model.js").Attributes): boolean;
        set(key: string | any, val?: string | any, options?: import("@converse/skeletor/src/types/model.js").Options): false | any;
        _changing: boolean;
        _previousAttributes: any;
        id: any;
        _pending: boolean | import("@converse/skeletor/src/types/model.js").Options;
        unset(attr: string, options?: import("@converse/skeletor/src/types/model.js").Options): false | any;
        clear(options: import("@converse/skeletor/src/types/model.js").Options): false | any;
        hasChanged(attr?: string): any;
        changedAttributes(diff: any): any;
        previous(attr?: string): any;
        previousAttributes(): any;
        fetch(options?: import("@converse/skeletor/src/types/model.js").Options): any;
        save(key?: string | import("@converse/skeletor/src/types/model.js").Attributes, val?: boolean | number | string | import("@converse/skeletor/src/types/model.js").Options, options?: import("@converse/skeletor/src/types/model.js").Options): any;
        destroy(options?: import("@converse/skeletor/src/types/model.js").Options): boolean;
        url(): any;
        parse(resp: import("@converse/skeletor/src/types/model.js").Options, options?: import("@converse/skeletor/src/types/model.js").Options): import("@converse/skeletor/src/types/model.js").Options;
        isNew(): boolean;
        isValid(options?: import("@converse/skeletor/src/types/model.js").Options): boolean;
        _validate(attrs: import("@converse/skeletor/src/types/model.js").Attributes, options?: import("@converse/skeletor/src/types/model.js").Options): boolean;
        on(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
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
        setColor(): Promise<void>;
        getIdentifier(): any;
        getColor(): Promise<string>;
        getAvatarStyle(append_style?: string): Promise<string>;
        cid: any;
        attributes: {};
        validationError: string;
        collection: any;
        changed: {};
        browserStorage: Storage;
        _browserStorage: Storage;
        readonly idAttribute: string;
        readonly cidPrefix: string;
        preinitialize(): void;
        initialize(attrs?: import("@converse/skeletor/src/types/model.js").Attributes, options?: import("@converse/skeletor/src/types/model.js").ModelOptions): void;
        validate(attrs: object, options?: object): string;
        toJSON(): any;
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: Model, options: import("@converse/skeletor/src/types/model.js").Options): any;
        get(attr: string): any;
        keys(): string[];
        values(): any[];
        pairs(): [string, any][];
        entries(): [string, any][];
        invert(): any;
        pick(...args: any[]): any;
        omit(...args: any[]): any;
        isEmpty(): any;
        has(attr: string): boolean;
        matches(attrs: import("@converse/skeletor/src/types/model.js").Attributes): boolean;
        set(key: string | any, val?: string | any, options?: import("@converse/skeletor/src/types/model.js").Options): false | any;
        _changing: boolean;
        _previousAttributes: any;
        id: any;
        _pending: boolean | import("@converse/skeletor/src/types/model.js").Options;
        unset(attr: string, options?: import("@converse/skeletor/src/types/model.js").Options): false | any;
        clear(options: import("@converse/skeletor/src/types/model.js").Options): false | any;
        hasChanged(attr?: string): any;
        changedAttributes(diff: any): any;
        previous(attr?: string): any;
        previousAttributes(): any;
        fetch(options?: import("@converse/skeletor/src/types/model.js").Options): any;
        save(key?: string | import("@converse/skeletor/src/types/model.js").Attributes, val?: boolean | number | string | import("@converse/skeletor/src/types/model.js").Options, options?: import("@converse/skeletor/src/types/model.js").Options): any;
        destroy(options?: import("@converse/skeletor/src/types/model.js").Options): boolean;
        url(): any;
        parse(resp: import("@converse/skeletor/src/types/model.js").Options, options?: import("@converse/skeletor/src/types/model.js").Options): import("@converse/skeletor/src/types/model.js").Options;
        isNew(): boolean;
        isValid(options?: import("@converse/skeletor/src/types/model.js").Options): boolean;
        _validate(attrs: import("@converse/skeletor/src/types/model.js").Attributes, options?: import("@converse/skeletor/src/types/model.js").Options): boolean;
        on(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
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
declare class RosterContact extends RosterContact_base {
    defaults(): {
        groups: any[];
        num_unread: number;
    };
    initialize(attrs: any): Promise<void>;
    initialized: Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    setPresence(): Promise<void>;
    presence: any;
    getStatus(): any;
    openChat(): void;
    /**
     * @param {import('./types').ContactDisplayNameOptions} [options]
     * @returns {string}
     */
    getDisplayName(options?: import("./types").ContactDisplayNameOptions): string;
    /**
     * Send a presence subscription request to this roster contact
     * @param {string} message - An optional message to explain the
     *      reason for the subscription request.
     */
    subscribe(message: string): this;
    /**
     * Upon receiving the presence stanza of type "subscribed",
     * the user SHOULD acknowledge receipt of that subscription
     * state notification by sending a presence stanza of type
     * "subscribe" to the contact
     */
    ackSubscribe(): void;
    /**
     * Upon receiving the presence stanza of type "unsubscribed",
     * the user SHOULD acknowledge receipt of that subscription state
     * notification by sending a presence stanza of type "unsubscribe"
     * this step lets the user's server know that it MUST no longer
     * send notification of the subscription state change to the user.
     */
    ackUnsubscribe(): void;
    /**
     * Unauthorize this contact's presence subscription
     * @param {string} [message] - Optional message to send to the person being unauthorized
     */
    unauthorize(message?: string): this;
    /**
     * Authorize presence subscription
     * @param {string} message - Optional message to send to the person being authorized
     */
    authorize(message: string): this;
    /**
     * Remove this contact from the roster
     * @async
     * @param {boolean} [unauthorize] - Whether to also unauthorize the
     * @returns {Promise<Error|Element>}
     */
    remove(unauthorize?: boolean): Promise<Error | Element>;
    /**
     * @param {import('./types').RosterContactUpdateAttrs} attrs
     * @returns {Promise}
     */
    update(attrs: import("./types").RosterContactUpdateAttrs): Promise<any>;
    /**
     * Instruct the XMPP server to remove this contact from our roster
     * @returns {Promise}
     */
    sendRosterRemoveStanza(): Promise<any>;
    isUnsaved(): boolean;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=contact.d.ts.map