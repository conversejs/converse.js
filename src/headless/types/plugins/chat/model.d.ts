export default ChatBox;
declare const ChatBox_base: {
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
        sync(method: import("@converse/skeletor").SyncOperation, model: import("@converse/skeletor").Model<any>, options: import("@converse/skeletor").Options): any;
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
        disable_mam: boolean;
        initialize(): Promise<void>;
        initNotifications(): void;
        notifications: import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>;
        initUI(): void;
        ui: import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>;
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
        onMessage(_attrs_or_error: import("../../shared/types").MessageAttributes | Error): Promise<void>;
        getUpdatedMessageAttributes(message: import("../../shared/message").default, attrs: import("../../shared/types").MessageAttributes): object;
        updateMessage(message: import("../../shared/message").default, attrs: import("../../shared/types").MessageAttributes): void;
        handleCorrection(attrs: import("../../shared/types").MessageAttributes | import("../muc/types.js").MUCMessageAttributes): Promise<import("../../shared/message").default | void>;
        queueMessage(attrs: import("../../shared/types").MessageAttributes): any;
        msg_chain: any;
        getOutgoingMessageAttributes(_attrs?: import("../../shared/types").MessageAttributes): Promise<import("../../shared/types").MessageAttributes>;
        sendMessage(attrs?: any): Promise<import("../../shared/message").default>;
        retractOwnMessage(message: import("../../shared/message").default): void;
        sendFiles(files: File[]): Promise<void>;
        setEditable(attrs: any, send_time: string): void;
        setChatState(state: string, options?: object): any;
        chat_state_timeout: NodeJS.Timeout;
        onMessageAdded(message: import("../../shared/message").default): void;
        onMessageUploadChanged(message: import("../../shared/message").default): Promise<void>;
        onMessageCorrecting(message: import("../../shared/message").default): void;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        shouldShowErrorMessage(attrs: import("../../shared/types").MessageAttributes): Promise<boolean>;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        isChatMessage(_message: import("../../shared/message").default): boolean;
        getOldestMessage(): import("../../shared/message").default;
        getMostRecentMessage(): import("../../shared/message").default;
        getMessageReferencedByError(attrs: object): any;
        findDanglingRetraction(attrs: object): import("../../shared/message").default | null;
        getDuplicateMessage(attrs: object): import("../../shared/message").default;
        getOriginIdQueryAttrs(attrs: object): {
            origin_id: any;
            from: any;
        };
        getStanzaIdQueryAttrs(attrs: object): {}[];
        getMessageBodyQueryAttrs(attrs: object): {
            from: any;
            msgid: any;
        };
        sendMarkerForMessage(msg: import("../../shared/message").default, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): Promise<void>;
        handleUnreadMessage(message: import("../../shared/message").default): void;
        getErrorAttributesForMessage(message: import("../../shared/message").default, attrs: import("../../shared/types").MessageAttributes): Promise<any>;
        handleErrorMessageStanza(stanza: Element): Promise<void>;
        incrementUnreadMsgsCounter(message: import("../../shared/message").default): void;
        clearUnreadMsgCounter(): void;
        handleRetraction(attrs: import("../../shared/types").MessageAttributes): Promise<boolean>;
        handleReceipt(attrs: import("../../shared/types").MessageAttributes): boolean;
        createMessageStanza(message: import("../../shared/message").default): Promise<any>;
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
        sync(method: import("@converse/skeletor").SyncOperation, model: import("@converse/skeletor").Model<any>, options: import("@converse/skeletor").Options): any;
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
        initialize(): void;
        rosterContactAdded: Promise<any> & {
            isResolved: boolean;
            isPending: boolean;
            isRejected: boolean;
            resolve: (value: any) => void;
            reject: (reason?: any) => void;
        };
        onClosedChanged: () => Promise<void>;
        contact: import("../roster/contact.js").default | import("../status/profile.js").default;
        setModelContact(jid: string): Promise<void>;
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
        sync(method: import("@converse/skeletor").SyncOperation, model: import("@converse/skeletor").Model<any>, options: import("@converse/skeletor").Options): any;
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
        sync(method: import("@converse/skeletor").SyncOperation, model: import("@converse/skeletor").Model<any>, options: import("@converse/skeletor").Options): any;
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
} & typeof ChatBoxBase;
/**
 * Represents a one-on-one chat conversation.
 */
declare class ChatBox extends ChatBox_base {
    constructor(attrs: any, options: any);
    /**
     * @typedef {import('./message.js').default} Message
     * @typedef {import('../muc/muc.js').default} MUC
     * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
     * @typedef {import('../../shared/errors').StanzaParseError} StanzaParseError
     */
    defaults(): {
        bookmarked: boolean;
        hidden: boolean;
        message_type: string;
        num_unread: number;
        time_opened: any;
        time_sent: string;
        type: string;
    };
    initialize(): Promise<void>;
    initialized: Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    /**
     * @param {string} jid
     */
    setPresence(jid: string): Promise<void>;
    presence: any;
    /**
     * @param {MessageAttributes|StanzaParseError} attrs_or_error
     */
    onMessage(attrs_or_error: import("../../shared/types").MessageAttributes | import("../../shared/errors").StanzaParseError): Promise<void>;
    /**
     * @param {import('../roster/presence').default} item
     */
    onPresenceChanged(item: import("../roster/presence").default): void;
    close(): Promise<void>;
    /**
     * @returns {string|null}
     */
    getDisplayName(): string | null;
    /**
     * @param {string} jid1
     * @param {string} jid2
     */
    isSameUser(jid1: string, jid2: string): any;
    /**
     * @param {MessageAttributes} attrs
     */
    handleChatMarker(attrs: import("../../shared/types").MessageAttributes): boolean;
    /**
     * @param {MessageAttributes} [attrs]
     * @return {Promise<MessageAttributes>}
     */
    getOutgoingMessageAttributes(attrs?: import("../../shared/types").MessageAttributes): Promise<import("../../shared/types").MessageAttributes>;
    canPostMessages(): boolean;
    /**
     * @param {import('../../shared/message').default} message
     */
    isChatMessage(message: import("../../shared/message").default): boolean;
}
import ChatBoxBase from '../../shared/chatbox.js';
//# sourceMappingURL=model.d.ts.map