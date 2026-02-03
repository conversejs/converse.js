/**
 * Adds a messages collection to a model and various methods related to sending
 * and receiving chat messages.
 *
 * This model should be UX-agnostic, except when it comes to the rendering of
 * messages. So there's no assumption of uniformity with regards to UI elements
 * represented by this object.
 *
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 */
export default function ModelWithMessages<T extends import("./types").ModelExtender>(BaseModel: T): {
    new (...args: any[]): {
        [x: string]: any;
        disable_mam: boolean;
        initialize(): Promise<void>;
        initNotifications(): void;
        notifications: Model<import("@converse/skeletor").ModelAttributes>;
        initUI(): void;
        ui: Model<import("@converse/skeletor").ModelAttributes>;
        /**
         * @returns {string}
         */
        getDisplayName(): string;
        canPostMessages(): boolean;
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
         * @param {MessageAttributes|Error} _attrs_or_error
         */
        onMessage(_attrs_or_error: import("./types").MessageAttributes | Error): Promise<void>;
        /**
         * @param {BaseMessage} message
         * @param {MessageAttributes} attrs
         * @returns {object}
         */
        getUpdatedMessageAttributes(message: import("./message").default, attrs: import("./types").MessageAttributes): object;
        /**
         * @param {BaseMessage} message
         * @param {MessageAttributes} attrs
         */
        updateMessage(message: import("./message").default, attrs: import("./types").MessageAttributes): void;
        /**
         * Determines whether the given attributes of an incoming message
         * represent a XEP-0308 correction and, if so, handles it appropriately.
         * @param {MessageAttributes|MUCMessageAttributes} attrs - Attributes representing a received
         *  message, as returned by {@link parseMessage}
         * @returns {Promise<BaseMessage|void>} Returns the corrected
         *  message or `undefined` if not applicable.
         */
        handleCorrection(attrs: import("./types").MessageAttributes | import("../plugins/muc/types.js").MUCMessageAttributes): Promise<import("./message").default | void>;
        /**
         * Queue an incoming `chat` message stanza for processing.
         * @param {MessageAttributes} attrs - A promise which resolves to the message attributes
         */
        queueMessage(attrs: import("./types").MessageAttributes): any;
        msg_chain: any;
        /**
         * @param {MessageAttributes} [_attrs]
         * @return {Promise<MessageAttributes>}
         */
        getOutgoingMessageAttributes(_attrs?: import("./types").MessageAttributes): Promise<import("./types").MessageAttributes>;
        /**
         * Responsible for sending off a text message inside an ongoing chat conversation.
         * @param {Object} [attrs] - A map of attributes to be saved on the message
         * @returns {Promise<BaseMessage>}
         * @example
         *  const chat = api.chats.get('buddy1@example.org');
         *  chat.sendMessage({'body': 'hello world'});
         */
        sendMessage(attrs?: any): Promise<import("./message").default>;
        /**
         * Retract one of your messages in this chat
         * @param {BaseMessage} message - The message which we're retracting.
         */
        retractOwnMessage(message: import("./message").default): void;
        /**
         * @param {File[]} files'
         */
        sendFiles(files: File[]): Promise<void>;
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
         * Mutator for setting the chat state of this chat session.
         * Handles clearing of any chat state notification timeouts and
         * setting new ones if necessary.
         * Timeouts are set when the  state being set is COMPOSING or PAUSED.
         * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
         * See XEP-0085 Chat State Notifications.
         * @param {string} state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
         * @param {object} [options]
         */
        setChatState(state: string, options?: object): any;
        chat_state_timeout: NodeJS.Timeout;
        /**
         * @param {BaseMessage} message
         */
        onMessageAdded(message: import("./message").default): void;
        /**
         * @param {BaseMessage} message
         */
        onMessageUploadChanged(message: import("./message").default): Promise<void>;
        /**
         * @param {BaseMessage} message
         */
        onMessageCorrecting(message: import("./message").default): void;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        /**
         * @param {MessageAttributes} attrs
         * @returns {Promise<boolean>}
         */
        shouldShowErrorMessage(attrs: import("./types").MessageAttributes): Promise<boolean>;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        /**
         * Used by sub-classes to indicate whether a message is a chat
         * message, as opposed to error or info messages.
         * @param {BaseMessage} _message
         * @returns {boolean}
         */
        isChatMessage(_message: import("./message").default): boolean;
        /** @returns {BaseMessage} */
        getOldestMessage(): import("./message").default;
        /** @returns {BaseMessage} */
        getMostRecentMessage(): import("./message").default;
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
         * @returns {BaseMessage|null}
         */
        findDanglingRetraction(attrs: object): import("./message").default | null;
        /**
         * Returns an already cached message (if it exists) based on the
         * passed in attributes map.
         * @param {object} attrs - Attributes representing a received
         *  message, as returned by {@link parseMessage}
         * @returns {BaseMessage}
         */
        getDuplicateMessage(attrs: object): import("./message").default;
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
         * @param {BaseMessage} msg
         * @param {('received'|'displayed'|'acknowledged')} [type='displayed']
         * @param {boolean} [force=false] - Whether a marker should be sent for the
         *  message, even if it didn't include a `markable` element.
         */
        sendMarkerForMessage(msg: import("./message").default, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): Promise<void>;
        /**
         * Given a newly received {@link BaseMessage} instance,
         * update the unread counter if necessary.
         * @param {BaseMessage} message
         */
        handleUnreadMessage(message: import("./message").default): void;
        /**
         * @param {BaseMessage} message
         * @param {MessageAttributes} attrs
         */
        getErrorAttributesForMessage(message: import("./message").default, attrs: import("./types").MessageAttributes): Promise<any>;
        /**
         * @param {Element} stanza
         */
        handleErrorMessageStanza(stanza: Element): Promise<void>;
        /**
         * @param {BaseMessage} message
         */
        incrementUnreadMsgsCounter(message: import("./message").default): void;
        clearUnreadMsgCounter(): void;
        /**
         * Handles message retraction based on the passed in attributes.
         * @param {MessageAttributes} attrs - Attributes representing a received
         *  message, as returned by {@link parseMessage}
         * @returns {Promise<Boolean>} Returns `true` or `false` depending on
         *  whether a message was retracted or not.
         */
        handleRetraction(attrs: import("./types").MessageAttributes): Promise<boolean>;
        /**
         * @param {MessageAttributes} attrs
         */
        handleReceipt(attrs: import("./types").MessageAttributes): boolean;
        /**
         * Given a {@link BaseMessage} return the XML stanza that represents it.
         * @method ChatBox#createMessageStanza
         * @param {BaseMessage} message - The message object
         */
        createMessageStanza(message: import("./message").default): Promise<any>;
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
} & T;
import { Model } from '@converse/skeletor';
//# sourceMappingURL=model-with-messages.d.ts.map