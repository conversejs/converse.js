declare const ChatBoxBase_base: {
    new (...args: any[]): {
        [x: string]: any;
        disable_mam: boolean;
        initialize(): Promise<void>;
        initNotifications(): void;
        notifications: Model<import("@converse/skeletor").ModelAttributes>;
        initUI(): void;
        ui: Model<import("@converse/skeletor").ModelAttributes>;
        getDisplayName(): string;
        canPostMessages(): boolean;
        createMessage(attrs: any, options: any): Promise<any>;
        getMessagesCacheKey(): string;
        getMessagesCollection(): any;
        getNotificationsText(): any;
        initMessages(): void;
        messages: any;
        fetchMessages(): any;
        afterMessagesFetched(): void;
        onMessage(_attrs_or_error: import("./types.js").MessageAttributes | Error): Promise<void>;
        getUpdatedMessageAttributes(message: import("./message.js").default, attrs: import("./types.js").MessageAttributes): object;
        updateMessage(message: import("./message.js").default, attrs: import("./types.js").MessageAttributes): void;
        handleCorrection(attrs: import("./types.js").MessageAttributes | import("../plugins/muc/types.js").MUCMessageAttributes): Promise<import("./message.js").default | void>;
        queueMessage(attrs: import("./types.js").MessageAttributes): any;
        msg_chain: any;
        getOutgoingMessageAttributes(_attrs?: import("./types.js").MessageAttributes): Promise<import("./types.js").MessageAttributes>;
        sendMessage(attrs?: any): Promise<import("./message.js").default>;
        retractOwnMessage(message: import("./message.js").default): void;
        sendFiles(files: File[]): Promise<void>;
        setEditable(attrs: any, send_time: string): void;
        setChatState(state: string, options?: object): any;
        chat_state_timeout: NodeJS.Timeout;
        onMessageAdded(message: import("./message.js").default): void;
        onMessageUploadChanged(message: import("./message.js").default): Promise<void>;
        onMessageCorrecting(message: import("./message.js").default): void;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        shouldShowErrorMessage(attrs: import("./types.js").MessageAttributes): Promise<boolean>;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        isChatMessage(_message: import("./message.js").default): boolean;
        getOldestMessage(): import("./message.js").default;
        getMostRecentMessage(): import("./message.js").default;
        getMessageReferencedByError(attrs: object): any;
        findDanglingRetraction(attrs: object): import("./message.js").default | null;
        getDuplicateMessage(attrs: object): import("./message.js").default;
        getOriginIdQueryAttrs(attrs: object): {
            origin_id: any;
            from: any;
        };
        getStanzaIdQueryAttrs(attrs: object): {}[];
        getMessageBodyQueryAttrs(attrs: object): {
            from: any;
            msgid: any;
        };
        sendMarkerForMessage(msg: import("./message.js").default, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): Promise<void>;
        handleUnreadMessage(message: import("./message.js").default): void;
        getErrorAttributesForMessage(message: import("./message.js").default, attrs: import("./types.js").MessageAttributes): Promise<any>;
        handleErrorMessageStanza(stanza: Element): Promise<void>;
        incrementUnreadMsgsCounter(message: import("./message.js").default): void;
        clearUnreadMsgCounter(): void;
        handleRetraction(attrs: import("./types.js").MessageAttributes): Promise<boolean>;
        handleReceipt(attrs: import("./types.js").MessageAttributes): boolean;
        createMessageStanza(message: import("./message.js").default): Promise<any>;
        pruneHistory(): void;
        debouncedPruneHistory: import("lodash").DebouncedFunc<() => void>;
        isScrolledUp(): any;
        isHidden(): boolean;
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
} & typeof Model;
/**
 * Base class for all chat boxes. Provides common methods.
 */
export default class ChatBoxBase extends ChatBoxBase_base {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    initialize(): Promise<void>;
    validate(attrs: any): string;
    /**
     * @param {boolean} force
     */
    maybeShow(force: boolean): this;
    shouldDestroyOnClose(): Promise<any>;
    /**
     * @param {Object} [_ev]
     */
    close(_ev?: any): Promise<void>;
    announceReconnection(): void;
    onReconnection(): Promise<void>;
}
import { Model } from '@converse/skeletor';
export {};
//# sourceMappingURL=chatbox.d.ts.map