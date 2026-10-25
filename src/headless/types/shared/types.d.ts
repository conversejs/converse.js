import { Builder, Strophe } from 'strophe.js';
import { Collection, FetchOrCreateOptions, Model } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import type { DebouncedFunc } from 'lodash';
import BaseMessage from './message';
import VCard from '../plugins/vcard/vcard';
import RosterContact from '../plugins/roster/contact';
import Profile from '../plugins/status/profile';
import { MUCMessageAttributes } from '../plugins/muc/types';
export type MessageAndStanza = {
    message: BaseMessage;
    stanza: Builder;
};
export type ReplaceableOpenPromise = ReturnType<typeof getOpenPromise> & {
    replace?: boolean;
};
export type ModelAttributes = Record<string, any>;
export type JIDModelAttributes = ModelAttributes & {
    jid: string;
};
export interface ModelOptions {
    collection?: Collection;
    parse?: boolean;
    unset?: boolean;
    silent?: boolean;
    fromStorage?: boolean;
}
export type RSMQueryOptions = {
    after?: string;
    before?: string;
    index?: number;
    max?: number;
};
export type RSMResult = {
    count?: string;
    first?: string;
    last?: string;
};
export type Constructor<T = {}> = new (...args: any[]) => T;
export type ModelExtender = Constructor<Model>;
export interface ColorAware {
    setColor(): Promise<void>;
    getIdentifier(): string;
    getColor(): Promise<string>;
    getAvatarStyle(append_style?: string): Promise<string>;
}
export interface VCardAware {
    _vcard: VCard | null;
    lazy_load_vcard: boolean;
    readonly vcard: VCard | null;
    getVCard(): Promise<VCard | null>;
}
export interface ContactAware {
    contact: RosterContact | Profile | null;
    rosterContactAdded: ReturnType<typeof getOpenPromise>;
    onClosedChanged: () => Promise<void>;
    updateContactUnreadCounter(): void;
    setModelContact(jid: string, options?: {
        create?: boolean;
    }): Promise<void>;
}
export interface MessagesAware {
    disable_mam: boolean;
    notifications: Model;
    ui: Model;
    messages: any;
    msg_chain: any;
    chat_state_timeout: number;
    debouncedPruneHistory: DebouncedFunc<() => void>;
    initNotifications(): void;
    initUI(): void;
    getDisplayName(): string;
    canPostMessages(): boolean;
    createMessage(attrs: MessageAttributes | ErrorMessageAttributes | InfoMessageAttributes, options?: FetchOrCreateOptions): Promise<any>;
    getMessagesCacheKey(): string;
    getMessagesCollection(): any;
    getNotificationsText(): any;
    initMessages(): void;
    fetchMessages(): any;
    afterMessagesFetched(): void;
    onMessage(attrs_or_error: MessageAttributes | Error): Promise<void>;
    getUpdatedMessageAttributes(message: BaseMessage, attrs: MessageAttributes): Promise<object>;
    updateMessage(message: BaseMessage, attrs: MessageAttributes): Promise<void>;
    getCorrectedMessage(attrs: MessageAttributes | MUCMessageAttributes): BaseMessage | undefined;
    handleCorrection(attrs: MessageAttributes | MUCMessageAttributes): Promise<BaseMessage | void>;
    handleOriginalOfCorrection(attrs: MessageAttributes | MUCMessageAttributes): BaseMessage | undefined;
    queueMessage(attrs: MessageAttributes): any;
    getOutgoingMessageAttributes(attrs?: MessageAttributes): Promise<MessageAttributes>;
    getReferencedMessage(reply_to_id: string): BaseMessage | undefined;
    takeReplyAttributes(attrs?: MessageAttributes): Pick<MessageAttributes, 'reply_to_id' | 'reply_to'>;
    addReplyFallback(attrs: MessageAttributes): MessageAttributes;
    sendMessage(attrs?: any): Promise<BaseMessage>;
    retractOwnMessage(message: BaseMessage): void;
    sendFiles(files: File[] | FileList): Promise<BaseMessage[]>;
    setEditable(attrs: any, send_time: string): void;
    setChatState(state: string, options?: object): any;
    onMessageAdded(message: BaseMessage): void;
    onMessageUploadChanged(message: BaseMessage): Promise<void>;
    onMessageCorrecting(message: BaseMessage): void;
    onScrolledChanged(): void;
    pruneHistoryWhenScrolledDown(): void;
    shouldShowErrorMessage(attrs: MessageAttributes): Promise<boolean>;
    clearMessages(): Promise<void>;
    editEarlierMessage(): void;
    editLaterMessage(): any;
    isChatMessage(message: BaseMessage): boolean;
    getOldestMessage(): BaseMessage;
    getMostRecentMessage(): BaseMessage;
    getMessageReferencedByError(attrs: object): any;
    findDanglingRetraction(attrs: object): BaseMessage | null;
    getDuplicateMessage(attrs: object): Promise<BaseMessage | undefined>;
    isCorrectionOf(attrs: object, message: BaseMessage): boolean;
    getOriginIdQueryAttrs(attrs: object): {
        origin_id: any;
        from: any;
    };
    getStanzaIdQueryAttrs(attrs: object): {}[];
    getMessageBodyQueryAttrs(attrs: object): {
        from: any;
        msgid: any;
    };
    sendMarkerForMessage(msg: BaseMessage, type?: MessageMarkerType, force?: boolean): Promise<void>;
    handleUnreadMessage(message: BaseMessage): void;
    getErrorAttributesForMessage(message: BaseMessage, attrs: MessageAttributes): Promise<any>;
    handleErrorMessageStanza(stanza: Element): Promise<void>;
    incrementUnreadMsgsCounter(message: BaseMessage): void;
    clearUnreadMsgCounter(): void;
    handleRetraction(attrs: MessageAttributes): Promise<boolean>;
    handleReceipt(attrs: MessageAttributes): boolean;
    createMessageStanza(message: BaseMessage): Promise<any>;
    pruneHistory(): void;
    isScrolledUp(): any;
    isHidden(): boolean;
}
export type StropheConnectionConstructor = new (...args: ConstructorParameters<typeof Strophe.Connection>) => InstanceType<typeof Strophe.Connection>;
type EncryptionPayloadAttrs = {
    key?: string;
    prekey?: boolean;
    device_id: string;
    payload?: string;
};
export type RetractionAttrs = {
    editable: boolean;
    is_tombstone?: boolean;
    retracted: string;
    retracted_id?: string;
    retraction_id?: string;
};
export type EncryptionAttrs = {
    encrypted?: EncryptionPayloadAttrs;
    is_encrypted: boolean;
    encryption_namespace: string;
};
export type XFormReportedField = {
    var: string;
    label: string;
};
export type XFormResultItemField = {
    var: string;
    value: string;
};
export type XFormOption = {
    value: string;
    label: string;
    selected: boolean;
    required: boolean;
};
export type XFormCaptchaURI = {
    type: string;
    data: string;
};
type XFormListTypes = 'list-single' | 'list-multi';
type XFormJIDTypes = 'jid-single' | 'jid-multi';
type XFormTextTypes = 'text-multi' | 'text-private' | 'text-single';
type XFormDateTypes = 'date' | 'datetime';
type XFormFieldTypes = XFormListTypes | XFormJIDTypes | XFormTextTypes | XFormDateTypes | 'fixed' | 'boolean' | 'url' | 'hidden';
export type XFormField = {
    var: string;
    label: string;
    type?: XFormFieldTypes;
    text?: string;
    value?: string;
    values?: string[];
    required?: boolean;
    checked?: boolean;
    options?: XFormOption[];
    uri?: XFormCaptchaURI;
    readonly: boolean;
};
export type XFormResponseType = 'result' | 'form';
export type XForm = {
    type: XFormResponseType;
    title?: string;
    instructions?: string;
    reported?: XFormReportedField[];
    items?: XFormResultItemField[][];
    fields?: XFormField[];
};
export type XEP372Reference = {
    begin: number;
    end: number;
    type: string;
    value: string;
    uri: string;
};
export type ErrorExtra = Record<string, string>;
export type ErrorName = 'bad-request' | 'conflict' | 'feature-not-implemented' | 'forbidden' | 'gone' | 'internal-server-error' | 'item-not-found' | 'jid-malformed' | 'not-acceptable' | 'not-allowed' | 'not-authorized' | 'payment-required' | 'recipient-unavailable' | 'redirect' | 'registration-required' | 'remote-server-not-found' | 'remote-server-timeout' | 'resource-constraint' | 'service-unavailable' | 'subscription-required' | 'undefined-condition' | 'unexpected-request';
export type ErrorType = 'auth' | 'cancel' | 'continue' | 'modify' | 'wait';
export type Reference = {
    begin: number;
    end: number;
    type: string;
    uri: string;
};
export type ErrorOrInfoMessageAttributes = {
    is_ephemeral?: boolean | number;
    message: string;
    reason?: string;
    time?: string;
};
export type ErrorMessageAttributes = ErrorOrInfoMessageAttributes & {
    chat_state?: boolean;
    retry_event_id?: string;
    type: 'error';
    upload?: 'failure';
};
export type InfoMessageAttributes = ErrorOrInfoMessageAttributes & {
    type: 'info';
    code?: string;
};
/**
 * Error attributes received on an error message stanza
 */
export type MessageErrorAttributes = {
    is_error: boolean;
    error: string;
    errors: {
        name: string;
        xmlns: string;
    }[];
    error_condition: string;
    error_text: string;
    error_type: string;
};
export type MessageStanzaTypes = 'chat' | 'normal' | 'headline' | 'groupchat' | 'error';
export type MessageAttributes = EncryptionAttrs & MessageErrorAttributes & {
    body: string;
    chat_state: string;
    contact_jid: string;
    editable: boolean;
    edited: string;
    from: string;
    message?: string;
    fullname: string;
    is_archived: boolean;
    is_carbon: boolean;
    is_delayed: boolean;
    is_encrypted: boolean;
    is_ephemeral: boolean | number;
    is_headline: boolean;
    is_markable: boolean;
    is_marker: boolean;
    is_only_emojis: boolean;
    is_spoiler: boolean;
    is_tombstone: boolean;
    is_unstyled: boolean;
    is_valid_receipt_request: boolean;
    marker: string;
    marker_id: string;
    msgid: string;
    nick: string;
    ogp_for_id?: string;
    oob_desc: string;
    oob_url: string;
    origin_id: string;
    plaintext: string;
    receipt_id: string;
    received: string;
    references: Array<XEP372Reference>;
    replace_id: string;
    reply_to_id: string;
    reply_to: string;
    fallback: Record<string, {
        start: number;
        end: number;
    } | null>;
    retracted: string;
    retracted_id: string;
    sender: 'me' | 'them';
    spoiler_hint: string;
    stanza_id: string;
    correction_stanza_ids?: Record<string, string[]>;
    subject: string;
    thread: string;
    time: string;
    to: string;
    type: MessageStanzaTypes;
};
export type FileUploadMessageAttributes = {
    body: string;
    message: string;
    oob_url: string;
    upload: 'success' | 'failure';
};
export type UploadService = {
    slot_request_url: string;
    max_file_size: number;
};
export type UploadSlotHeader = {
    name: string;
    value: string;
};
export type UploadTarget = {
    put: string;
    headers?: UploadSlotHeader[];
};
export type UploadSlot = UploadTarget & {
    get: string;
};
export type UploadedFile = {
    url: string;
    name: string;
    type: string;
    size: number;
};
export type MessageMarkerType = 'displayed' | 'received' | 'acknowledged';
export type ChatStateType = 'active' | 'composing' | 'paused' | 'inactive' | 'gone';
export type StorageKeys = {
    storage_key: string;
    fetched_flag_key: string;
};
export type ChatBoxOrMUC = import('../plugins/chat/model.js').default | import('../plugins/muc/muc.js').default;
export type MessageEventData = {
    stanza: Element;
    attrs: MessageAttributes;
    chatbox?: import('../plugins/chat/model.js').default | import('../plugins/headlines/feed.js').default;
};
export type BaseMessageAttributes = ModelAttributes & Omit<MessageAttributes, 'type'> & {
    type: MessageStanzaTypes | 'info';
};
export {};
//# sourceMappingURL=types.d.ts.map