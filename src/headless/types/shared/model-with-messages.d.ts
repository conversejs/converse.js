/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 */
export default function ModelWithMessages<T extends import("./types").ModelExtender>(BaseModel: T): {
    new (...args: any[]): {
        initialize(): Promise<void>;
        initNotifications(): void;
        notifications: Model;
        initUI(): void;
        ui: Model;
        /**
         * @returns {string}
         */
        getDisplayName(): string;
        /**
         * Queue the creation of a message, to make sure that we don't run
         * into a race condition whereby we're creating a new message
         * before the collection has been fetched.
         * @param {Object} attrs
         * @param {Object} options
         */
        createMessage(attrs: any, options: any): Promise<any>;
        getMessagesCacheKey(): string;
        getMessagesCollection(): any;
        getNotificationsText(): any;
        initMessages(): void;
        messages: any;
        fetchMessages(): any;
        afterMessagesFetched(): void;
        /**
         * @param {Promise<MessageAttributes>} _promise
         */
        onMessage(_promise: Promise<import("../plugins/chat/parsers").MessageAttributes>): Promise<void>;
        /**
         * @param {Message} message
         * @param {MessageAttributes} attrs
         * @returns {object}
         */
        getUpdatedMessageAttributes(message: import("../plugins/chat/message").default, attrs: import("../plugins/chat/parsers").MessageAttributes): object;
        /**
         * @param {Message} message
         * @param {MessageAttributes} attrs
         */
        updateMessage(message: import("../plugins/chat/message").default, attrs: import("../plugins/chat/parsers").MessageAttributes): void;
        /**
         * Determines whether the given attributes of an incoming message
         * represent a XEP-0308 correction and, if so, handles it appropriately.
         * @param {MessageAttributes|MUCMessageAttributes} attrs - Attributes representing a received
         *  message, as returned by {@link parseMessage}
         * @returns {Promise<Message|void>} Returns the corrected
         *  message or `undefined` if not applicable.
         */
        handleCorrection(attrs: import("../plugins/chat/parsers").MessageAttributes | import("../plugins/muc/parsers").MUCMessageAttributes): Promise<import("../plugins/chat/message").default | void>;
        /**
         * Queue an incoming `chat` message stanza for processing.
         * @param {Promise<MessageAttributes>} attrs - A promise which resolves to the message attributes
         */
        queueMessage(attrs: Promise<import("../plugins/chat/parsers").MessageAttributes>): any;
        msg_chain: any;
        /**
         * @param {MessageAttributes} [_attrs]
         * @return {Promise<MessageAttributes>}
         */
        getOutgoingMessageAttributes(_attrs?: import("../plugins/chat/parsers").MessageAttributes): Promise<import("../plugins/chat/parsers").MessageAttributes>;
        /**
         * Responsible for sending off a text message inside an ongoing chat conversation.
         * @param {Object} [attrs] - A map of attributes to be saved on the message
         * @returns {Promise<Message>}
         * @example
         *  const chat = api.chats.get('buddy1@example.org');
         *  chat.sendMessage({'body': 'hello world'});
         */
        sendMessage(attrs?: any): Promise<import("../plugins/chat/message").default>;
        /**
         * Responsible for setting the editable attribute of messages.
         * If api.settings.get('allow_message_corrections') is "last", then only the last
         * message sent from me will be editable. If set to "all" all messages
         * will be editable. Otherwise no messages will be editable.
         * @param {Object} attrs An object containing message attributes.
         * @param {String} send_time - time when the message was sent
         */
        setEditable(attrs: any, send_time: string): void;
        /**
         * @param {Message} message
         */
        onMessageAdded(message: import("../plugins/chat/message").default): void;
        /**
         * @param {Message} message
         */
        onMessageUploadChanged(message: import("../plugins/chat/message").default): Promise<void>;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        getOldestMessage(): any;
        getMostRecentMessage(): any;
        /**
         * Given an error `<message>` stanza's attributes, find the saved message model which is
         * referenced by that error.
         * @param {object} attrs
         */
        getMessageReferencedByError(attrs: object): any;
        /**
         * Looks whether we already have a retraction for this
         * incoming message. If so, it's considered "dangling" because it
         * probably hasn't been applied to anything yet, given that the
         * relevant message is only coming in now.
         * @param {object} attrs - Attributes representing a received
         *  message, as returned by {@link parseMessage}
         * @returns {Message|null}
         */
        findDanglingRetraction(attrs: object): import("../plugins/chat/message").default | null;
        /**
         * Returns an already cached message (if it exists) based on the
         * passed in attributes map.
         * @param {object} attrs - Attributes representing a received
         *  message, as returned by {@link parseMessage}
         * @returns {Message}
         */
        getDuplicateMessage(attrs: object): import("../plugins/chat/message").default;
        /**
         * @param {object} attrs - Attributes representing a received
         */
        getOriginIdQueryAttrs(attrs: object): {
            origin_id: any;
            from: any;
        };
        /**
         * @param {object} attrs - Attributes representing a received
         */
        getStanzaIdQueryAttrs(attrs: object): {}[];
        /**
         * @param {object} attrs - Attributes representing a received
         */
        getMessageBodyQueryAttrs(attrs: object): {
            from: any;
            msgid: any;
        };
        /**
         * Given the passed in message object, send a XEP-0333 chat marker.
         * @param {Message} msg
         * @param {('received'|'displayed'|'acknowledged')} [type='displayed']
         * @param {Boolean} force - Whether a marker should be sent for the
         *  message, even if it didn't include a `markable` element.
         */
        sendMarkerForMessage(msg: import("../plugins/chat/message").default, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): void;
        /**
         * Given a newly received {@link Message} instance,
         * update the unread counter if necessary.
         * @param {Message} message
         */
        handleUnreadMessage(message: import("../plugins/chat/message").default): void;
        /**
         * @param {Message} message
         */
        incrementUnreadMsgsCounter(message: import("../plugins/chat/message").default): void;
        clearUnreadMsgCounter(): void;
        /**
         * Handles message retraction based on the passed in attributes.
         * @param {MessageAttributes} attrs - Attributes representing a received
         *  message, as returned by {@link parseMessage}
         * @returns {Promise<Boolean>} Returns `true` or `false` depending on
         *  whether a message was retracted or not.
         */
        handleRetraction(attrs: import("../plugins/chat/parsers").MessageAttributes): Promise<boolean>;
        /**
         * @param {MessageAttributes} attrs
         */
        handleReceipt(attrs: import("../plugins/chat/parsers").MessageAttributes): boolean;
        /**
         * Given a {@link Message} return the XML stanza that represents it.
         * @private
         * @method ChatBox#createMessageStanza
         * @param { Message } message - The message object
         */
        createMessageStanza(message: import("../plugins/chat/message").default): Promise<any>;
        /**
         * Prunes the message history to ensure it does not exceed the maximum
         * number of messages specified in the settings.
         */
        pruneHistory(): void;
        debouncedPruneHistory: import("lodash").DebouncedFunc<() => void>;
        isScrolledUp(): any;
        /**
         * Indicates whether the chat is hidden and therefore
         * whether a newly received message will be visible to the user or not.
         * @returns {boolean}
         */
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
} & T;
import { Model } from '@converse/skeletor';
//# sourceMappingURL=model-with-messages.d.ts.map