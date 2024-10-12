export default MUCOccupant;
declare const MUCOccupant_base: {
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
        onMessage(_promise: Promise<import("../chat/parsers").MessageAttributes>): Promise<void>;
        getUpdatedMessageAttributes(message: import("../chat").Message, attrs: import("../chat/parsers").MessageAttributes): object;
        updateMessage(message: import("../chat").Message, attrs: import("../chat/parsers").MessageAttributes): void;
        handleCorrection(attrs: import("../chat/parsers").MessageAttributes | import("./parsers").MUCMessageAttributes): Promise<import("../chat").Message | void>;
        queueMessage(attrs: Promise<import("../chat/parsers").MessageAttributes>): any;
        msg_chain: any;
        getOutgoingMessageAttributes(_attrs?: import("../chat/parsers").MessageAttributes): Promise<import("../chat/parsers").MessageAttributes>;
        sendMessage(attrs?: any): Promise<import("../chat").Message>;
        retractOwnMessage(message: import("../chat").Message): void;
        sendFiles(files: File[]): Promise<void>;
        setEditable(attrs: any, send_time: string): void;
        setChatState(state: string, options?: object): any;
        chat_state_timeout: NodeJS.Timeout;
        onMessageAdded(message: import("../chat").Message): void;
        onMessageUploadChanged(message: import("../chat").Message): Promise<void>;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        shouldShowErrorMessage(attrs: import("../chat/parsers").MessageAttributes): Promise<boolean>;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        getOldestMessage(): any;
        getMostRecentMessage(): any;
        getMessageReferencedByError(attrs: object): any;
        findDanglingRetraction(attrs: object): import("../chat").Message | null;
        getDuplicateMessage(attrs: object): import("../chat").Message;
        getOriginIdQueryAttrs(attrs: object): {
            origin_id: any;
            from: any;
        };
        getStanzaIdQueryAttrs(attrs: object): {}[];
        getMessageBodyQueryAttrs(attrs: object): {
            from: any;
            msgid: any;
        };
        sendMarkerForMessage(msg: import("../chat").Message, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): void;
        handleUnreadMessage(message: import("../chat").Message): void;
        handleErrorMessageStanza(stanza: Element): Promise<void>;
        incrementUnreadMsgsCounter(message: import("../chat").Message): void;
        clearUnreadMsgCounter(): void;
        handleRetraction(attrs: import("../chat/parsers").MessageAttributes): Promise<boolean>;
        handleReceipt(attrs: import("../chat/parsers").MessageAttributes): boolean;
        createMessageStanza(message: import("../chat").Message): Promise<any>;
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
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: Model, options: import("@converse/skeletor/src/types/model").Options): any;
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
        matches(attrs: import("@converse/skeletor/src/types/model").Attributes): boolean;
        set(key: string | any, val?: string | any, options?: import("@converse/skeletor/src/types/model").Options): false | any;
        _changing: boolean;
        _previousAttributes: any;
        id: any;
        _pending: boolean | import("@converse/skeletor/src/types/model").Options;
        unset(attr: string, options?: import("@converse/skeletor/src/types/model").Options): false | any;
        clear(options: import("@converse/skeletor/src/types/model").Options): false | any;
        hasChanged(attr?: string): any;
        changedAttributes(diff: any): any;
        previous(attr?: string): any;
        previousAttributes(): any;
        fetch(options?: import("@converse/skeletor/src/types/model").Options): any;
        save(key?: string | import("@converse/skeletor/src/types/model").Attributes, val?: boolean | number | string | import("@converse/skeletor/src/types/model").Options, options?: import("@converse/skeletor/src/types/model").Options): any;
        destroy(options?: import("@converse/skeletor/src/types/model").Options): boolean;
        url(): any;
        parse(resp: import("@converse/skeletor/src/types/model").Options, options?: import("@converse/skeletor/src/types/model").Options): import("@converse/skeletor/src/types/model").Options;
        isNew(): boolean;
        isValid(options?: import("@converse/skeletor/src/types/model").Options): boolean;
        _validate(attrs: import("@converse/skeletor/src/types/model").Attributes, options?: import("@converse/skeletor/src/types/model").Options): boolean;
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
        initialize(): void;
        validate(attrs: object, options?: object): string;
        toJSON(): any;
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: Model, options: import("@converse/skeletor/src/types/model").Options): any;
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
        matches(attrs: import("@converse/skeletor/src/types/model").Attributes): boolean;
        set(key: string | any, val?: string | any, options?: import("@converse/skeletor/src/types/model").Options): false | any;
        _changing: boolean;
        _previousAttributes: any;
        id: any;
        _pending: boolean | import("@converse/skeletor/src/types/model").Options;
        unset(attr: string, options?: import("@converse/skeletor/src/types/model").Options): false | any;
        clear(options: import("@converse/skeletor/src/types/model").Options): false | any;
        hasChanged(attr?: string): any;
        changedAttributes(diff: any): any;
        previous(attr?: string): any;
        previousAttributes(): any;
        fetch(options?: import("@converse/skeletor/src/types/model").Options): any;
        save(key?: string | import("@converse/skeletor/src/types/model").Attributes, val?: boolean | number | string | import("@converse/skeletor/src/types/model").Options, options?: import("@converse/skeletor/src/types/model").Options): any;
        destroy(options?: import("@converse/skeletor/src/types/model").Options): boolean;
        url(): any;
        parse(resp: import("@converse/skeletor/src/types/model").Options, options?: import("@converse/skeletor/src/types/model").Options): import("@converse/skeletor/src/types/model").Options;
        isNew(): boolean;
        isValid(options?: import("@converse/skeletor/src/types/model").Options): boolean;
        _validate(attrs: import("@converse/skeletor/src/types/model").Attributes, options?: import("@converse/skeletor/src/types/model").Options): boolean;
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
 * Represents a participant in a MUC
 */
declare class MUCOccupant extends MUCOccupant_base {
    /**
     * @typedef {module:plugin-chat-parsers.MessageAttributes} MessageAttributes
     */
    constructor(attributes: any, options: any);
    vcard: any;
    initialize(): Promise<void>;
    defaults(): {
        hats: any[];
        show: string;
        states: any[];
        hidden: boolean;
        num_unread: number;
    };
    save(key: any, val: any, options: any): any;
    getMessagesCollection(): MUCMessages;
    /**
     * Handler for all MUC private messages sent to this occupant.
     * This method houldn't be called directly, instead {@link MUC#queueMessage} should be called.
     * @param {Promise<MessageAttributes>} promise
     */
    onMessage(promise: Promise<any>): Promise<void>;
    /**
     * Return roles which may be assigned to this occupant
     * @returns {typeof ROLES} - An array of assignable roles
     */
    getAssignableRoles(): typeof ROLES;
    /**
     * Return affiliations which may be assigned by this occupant
     * @returns {typeof AFFILIATIONS} An array of assignable affiliations
     */
    getAssignableAffiliations(): typeof AFFILIATIONS;
    isMember(): boolean;
    isModerator(): boolean;
    isSelf(): any;
}
import { Model } from '@converse/skeletor';
import MUCMessages from './messages.js';
import { ROLES } from './constants.js';
import { AFFILIATIONS } from './constants.js';
//# sourceMappingURL=occupant.d.ts.map