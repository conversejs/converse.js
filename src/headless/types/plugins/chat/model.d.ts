export default ChatBox;
declare const ChatBox_base: {
    new (...args: any[]): {
        initialize(): Promise<void>;
        initNotifications(): void;
        notifications: import("@converse/skeletor").Model;
        initUI(): void;
        ui: import("@converse/skeletor").Model;
        getDisplayName(): string;
        createMessage(attrs: any, options: any): Promise<any>;
        getMessagesCacheKey(): string;
        getMessagesCollection(): any;
        getNotificationsText(): any;
        initMessages(): void;
        messages: any;
        fetchMessages(): any;
        afterMessagesFetched(): void;
        onMessage(_promise: Promise<import("./parsers.js").MessageAttributes>): Promise<void>;
        getUpdatedMessageAttributes(message: import("./message.js").default, attrs: import("./parsers.js").MessageAttributes): object;
        updateMessage(message: import("./message.js").default, attrs: import("./parsers.js").MessageAttributes): void;
        handleCorrection(attrs: import("./parsers.js").MessageAttributes | import("../muc/parsers.js").MUCMessageAttributes): Promise<import("./message.js").default | void>;
        queueMessage(attrs: Promise<import("./parsers.js").MessageAttributes>): any;
        msg_chain: any;
        getOutgoingMessageAttributes(_attrs?: import("./parsers.js").MessageAttributes): Promise<import("./parsers.js").MessageAttributes>;
        sendMessage(attrs?: any): Promise<import("./message.js").default>;
        setEditable(attrs: any, send_time: string): void;
        onMessageAdded(message: import("./message.js").default): void;
        onMessageUploadChanged(message: import("./message.js").default): Promise<void>;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        getOldestMessage(): any;
        getMostRecentMessage(): any;
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
        sendMarkerForMessage(msg: import("./message.js").default, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): void;
        handleUnreadMessage(message: import("./message.js").default): void;
        incrementUnreadMsgsCounter(message: import("./message.js").default): void;
        clearUnreadMsgCounter(): void;
        handleRetraction(attrs: import("./parsers.js").MessageAttributes): Promise<boolean>;
        handleReceipt(attrs: import("./parsers.js").MessageAttributes): boolean;
        createMessageStanza(message: import("./message.js").default): Promise<any>;
        pruneHistory(): void;
        debouncedPruneHistory: import("lodash").DebouncedFunc<() => void>;
        isScrolledUp(): any;
        isHidden(): boolean;
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
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: import("@converse/skeletor").Model, options: import("@converse/skeletor/src/types/model.js").Options): any;
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
        on(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
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
        initialize(): void;
        rosterContactAdded: any;
        contact: import("../roster/contact.js").default | import("../status/status.js").default;
        vcard: import("../vcard/vcard.js").default;
        setModelContact(jid: string): Promise<void>;
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
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: import("@converse/skeletor").Model, options: import("@converse/skeletor/src/types/model.js").Options): any;
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
        on(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
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
        initialize(): void;
        validate(attrs: object, options?: object): string;
        toJSON(): any;
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: import("@converse/skeletor").Model, options: import("@converse/skeletor/src/types/model.js").Options): any;
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
        on(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
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
     * @typedef {import('./parsers').MessageAttributes} MessageAttributes
     * @typedef {import('../../shared/parsers').StanzaParseError} StanzaParseError
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
    disable_mam: boolean;
    initialize(): Promise<void>;
    initialized: any;
    presence: any;
    /**
     * @param {Element} stanza
     */
    handleErrorMessageStanza(stanza: Element): Promise<void>;
    /**
     * @param {Promise<MessageAttributes|StanzaParseError>} attrs_promise
     */
    onMessage(attrs_promise: Promise<import("./parsers.js").MessageAttributes | import("../../shared/parsers").StanzaParseError>): Promise<void>;
    onPresenceChanged(item: any): void;
    close(): Promise<void>;
    /**
     * Mutator for setting the chat state of this chat session.
     * Handles clearing of any chat state notification timeouts and
     * setting new ones if necessary.
     * Timeouts are set when the  state being set is COMPOSING or PAUSED.
     * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
     * See XEP-0085 Chat State Notifications.
     * @param {string} state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
     * @param {object} [options]
     */
    setChatState(state: string, options?: object): this;
    chat_state_timeout: NodeJS.Timeout;
    /**
     * @returns {string}
     */
    getDisplayName(): string;
    /**
     * @param {MessageAttributes} attrs
     * @returns {Promise<boolean>}
     */
    shouldShowErrorMessage(attrs: import("./parsers.js").MessageAttributes): Promise<boolean>;
    /**
     * @param {string} jid1
     * @param {string} jid2
     */
    isSameUser(jid1: string, jid2: string): any;
    /**
     * Retract one of your messages in this chat
     * @param {Message} message - The message which we're retracting.
     */
    retractOwnMessage(message: import("./message.js").default): void;
    /**
     * @param {MessageAttributes} attrs
     */
    handleChatMarker(attrs: import("./parsers.js").MessageAttributes): boolean;
    /**
     * @param {MessageAttributes} [attrs]
     * @return {Promise<MessageAttributes>}
     */
    getOutgoingMessageAttributes(attrs?: import("./parsers.js").MessageAttributes): Promise<import("./parsers.js").MessageAttributes>;
    /**
     * @param {File[]} files
     */
    sendFiles(files: File[]): Promise<void>;
    canPostMessages(): boolean;
}
import ChatBoxBase from '../../shared/chatbox.js';
//# sourceMappingURL=model.d.ts.map