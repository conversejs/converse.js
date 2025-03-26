export default MUCOccupant;
declare const MUCOccupant_base: {
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
        onMessage(_attrs_or_error: import("../../shared/types").MessageAttributes | Error): Promise<void>;
        getUpdatedMessageAttributes(message: import("../../index.js").BaseMessage<any>, attrs: import("../../shared/types").MessageAttributes): object;
        updateMessage(message: import("../../index.js").BaseMessage<any>, attrs: import("../../shared/types").MessageAttributes): void;
        handleCorrection(attrs: import("../../shared/types").MessageAttributes | import("./types.js").MUCMessageAttributes): Promise<import("../../index.js").BaseMessage<any> | void>;
        queueMessage(attrs: import("../../shared/types").MessageAttributes): any;
        msg_chain: any;
        getOutgoingMessageAttributes(_attrs?: import("../../shared/types").MessageAttributes): Promise<import("../../shared/types").MessageAttributes>;
        sendMessage(attrs?: any): Promise<import("../../index.js").BaseMessage<any>>;
        retractOwnMessage(message: import("../../index.js").BaseMessage<any>): void;
        sendFiles(files: File[]): Promise<void>;
        setEditable(attrs: any, send_time: string): void;
        setChatState(state: string, options?: object): any;
        chat_state_timeout: NodeJS.Timeout;
        onMessageAdded(message: import("../../index.js").BaseMessage<any>): void;
        onMessageUploadChanged(message: import("../../index.js").BaseMessage<any>): Promise<void>;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        shouldShowErrorMessage(attrs: import("../../shared/types").MessageAttributes): Promise<boolean>;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        getOldestMessage(): any;
        getMostRecentMessage(): any;
        getMessageReferencedByError(attrs: object): any;
        findDanglingRetraction(attrs: object): import("../../index.js").BaseMessage<any> | null;
        getDuplicateMessage(attrs: object): import("../../index.js").BaseMessage<any>;
        getOriginIdQueryAttrs(attrs: object): {
            origin_id: any;
            from: any;
        };
        getStanzaIdQueryAttrs(attrs: object): {}[];
        getMessageBodyQueryAttrs(attrs: object): {
            from: any;
            msgid: any;
        };
        sendMarkerForMessage(msg: import("../../index.js").BaseMessage<any>, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): Promise<void>;
        handleUnreadMessage(message: import("../../index.js").BaseMessage<any>): void;
        getErrorAttributesForMessage(message: import("../../index.js").BaseMessage<any>, attrs: import("../../shared/types").MessageAttributes): Promise<any>;
        handleErrorMessageStanza(stanza: Element): Promise<void>;
        incrementUnreadMsgsCounter(message: import("../../index.js").BaseMessage<any>): void;
        clearUnreadMsgCounter(): void;
        handleRetraction(attrs: import("../../shared/types").MessageAttributes): Promise<boolean>;
        handleReceipt(attrs: import("../../shared/types").MessageAttributes): boolean;
        createMessageStanza(message: import("../../index.js").BaseMessage<any>): Promise<any>;
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
 * Represents a participant in a MUC
 */
declare class MUCOccupant extends MUCOccupant_base {
    /**
     * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
     * @typedef {import('../../shared/errors').StanzaParseError} StanzaParseError
     */
    initialize(): Promise<void>;
    defaults(): {
        jid: any;
        nick: any;
        hats: any[];
        show: string;
        states: any[];
        hidden: boolean;
        num_unread: number;
        message_type: string;
    };
    save(key: any, val: any, options: any): any;
    getMessagesCollection(): MUCMessages;
    /**
     * Handler for all MUC private messages sent to this occupant.
     * This method houldn't be called directly, instead {@link MUC#queueMessage} should be called.
     * @param {MessageAttributes|StanzaParseError} attrs_or_error
     */
    onMessage(attrs_or_error: import("../../shared/types").MessageAttributes | import("../../shared/errors").StanzaParseError): Promise<void>;
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
    /**
     * @param {import('../chat/message').default} message - The message object
     */
    createMessageStanza(message: import("../chat/message").default): Promise<any>;
}
import { Model } from "@converse/skeletor";
import MUCMessages from "./messages.js";
import { ROLES } from "./constants.js";
import { AFFILIATIONS } from "./constants.js";
//# sourceMappingURL=occupant.d.ts.map