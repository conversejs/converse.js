declare const ChatBoxBase_base: {
    new (...args: any[]): {
        disable_mam: boolean;
        initialize(): Promise<void>;
        initNotifications(): void;
        notifications: Model;
        initUI(): void;
        ui: Model;
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
        onMessage(_attrs_or_error: import("../plugins/chat/types.js").MessageAttributes | Error): Promise<void>;
        getUpdatedMessageAttributes(message: import("../index.js").Message, attrs: import("../plugins/chat/types.js").MessageAttributes): object;
        updateMessage(message: import("../index.js").Message, attrs: import("../plugins/chat/types.js").MessageAttributes): void;
        handleCorrection(attrs: import("../plugins/chat/types.js").MessageAttributes | import("../plugins/muc/types.js").MUCMessageAttributes): Promise<import("../index.js").Message | void>;
        queueMessage(attrs: import("../plugins/chat/types.js").MessageAttributes): any;
        msg_chain: any;
        getOutgoingMessageAttributes(_attrs?: import("../plugins/chat/types.js").MessageAttributes): Promise<import("../plugins/chat/types.js").MessageAttributes>;
        sendMessage(attrs?: any): Promise<import("../index.js").Message>;
        retractOwnMessage(message: import("../index.js").Message): void;
        sendFiles(files: File[]): Promise<void>;
        setEditable(attrs: any, send_time: string): void;
        setChatState(state: string, options?: object): any;
        chat_state_timeout: NodeJS.Timeout;
        onMessageAdded(message: import("../index.js").Message): void;
        onMessageUploadChanged(message: import("../index.js").Message): Promise<void>;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        shouldShowErrorMessage(attrs: import("../plugins/chat/types.js").MessageAttributes): Promise<boolean>;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        getOldestMessage(): any;
        getMostRecentMessage(): any;
        getMessageReferencedByError(attrs: object): any;
        findDanglingRetraction(attrs: object): import("../index.js").Message | null;
        getDuplicateMessage(attrs: object): import("../index.js").Message;
        getOriginIdQueryAttrs(attrs: object): {
            origin_id: any;
            from: any;
        };
        getStanzaIdQueryAttrs(attrs: object): {}[];
        getMessageBodyQueryAttrs(attrs: object): {
            from: any;
            msgid: any;
        };
        sendMarkerForMessage(msg: import("../index.js").Message, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): Promise<void>;
        handleUnreadMessage(message: import("../index.js").Message): void;
        getErrorAttributesForMessage(message: import("../index.js").Message, attrs: import("../plugins/chat/types.js").MessageAttributes): Promise<any>;
        handleErrorMessageStanza(stanza: Element): Promise<void>;
        incrementUnreadMsgsCounter(message: import("../index.js").Message): void;
        clearUnreadMsgCounter(): void;
        handleRetraction(attrs: import("../plugins/chat/types.js").MessageAttributes): Promise<boolean>;
        handleReceipt(attrs: import("../plugins/chat/types.js").MessageAttributes): boolean;
        createMessageStanza(message: import("../index.js").Message): Promise<any>;
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
/**
 * Base class for all chat boxes. Provides common methods.
 */
export default class ChatBoxBase extends ChatBoxBase_base {
    initialize(): Promise<void>;
    validate(attrs: any): string;
    /**
     * @param {boolean} force
     */
    maybeShow(force: boolean): this;
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