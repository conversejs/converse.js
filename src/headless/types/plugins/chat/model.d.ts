export default ChatBox;
export type Message = import('./message.js').default;
export type MUC = import('../muc/muc.js').default;
export type MUCMessage = import('../muc/message.js').default;
export type MessageAttributes = any;
export namespace Strophe {
    type Builder = any;
}
/**
 * Represents an open/ongoing chat conversation.
 * @namespace ChatBox
 * @memberOf _converse
 */
declare class ChatBox extends ModelWithContact {
    constructor(attrs: any, options: any);
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
    getMessagesCollection(): any;
    getMessagesCacheKey(): string;
    initMessages(): void;
    messages: any;
    initUI(): void;
    ui: Model;
    initNotifications(): void;
    notifications: Model;
    getNotificationsText(): any;
    afterMessagesFetched(): void;
    fetchMessages(): any;
    handleErrorMessageStanza(stanza: any): Promise<void>;
    /**
     * Queue an incoming `chat` message stanza for processing.
     * @async
     * @method ChatBox#queueMessage
     * @param {MessageAttributes} attrs - A promise which resolves to the message attributes
     */
    queueMessage(attrs: any): any;
    msg_chain: any;
    /**
     * @async
     * @method ChatBox#onMessage
     * @param {Promise<MessageAttributes>} attrs_promise - A promise which resolves to the message attributes.
     */
    onMessage(attrs_promise: Promise<MessageAttributes>): Promise<void>;
    onMessageUploadChanged(message: any): Promise<void>;
    onMessageAdded(message: any): void;
    clearMessages(): Promise<void>;
    close(): Promise<void>;
    announceReconnection(): void;
    onReconnection(): Promise<void>;
    onPresenceChanged(item: any): void;
    onScrolledChanged(): void;
    pruneHistoryWhenScrolledDown(): void;
    validate(attrs: any): string;
    getDisplayName(): any;
    createMessageFromError(error: any): Promise<void>;
    editEarlierMessage(): void;
    editLaterMessage(): any;
    getOldestMessage(): any;
    getMostRecentMessage(): any;
    getUpdatedMessageAttributes(message: any, attrs: any): any;
    updateMessage(message: any, attrs: any): void;
    /**
     * Mutator for setting the chat state of this chat session.
     * Handles clearing of any chat state notification timeouts and
     * setting new ones if necessary.
     * Timeouts are set when the  state being set is COMPOSING or PAUSED.
     * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
     * See XEP-0085 Chat State Notifications.
     * @method ChatBox#setChatState
     * @param { string } state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
     */
    setChatState(state: string, options: any): ChatBox;
    chat_state_timeout: number;
    /**
     * Given an error `<message>` stanza's attributes, find the saved message model which is
     * referenced by that error.
     * @param {object} attrs
     */
    getMessageReferencedByError(attrs: object): any;
    /**
     * @method ChatBox#shouldShowErrorMessage
     * @param {object} attrs
     * @returns {Promise<boolean>}
     */
    shouldShowErrorMessage(attrs: object): Promise<boolean>;
    /**
     * @param {string} jid1
     * @param {string} jid2
     */
    isSameUser(jid1: string, jid2: string): any;
    /**
     * Looks whether we already have a retraction for this
     * incoming message. If so, it's considered "dangling" because it
     * probably hasn't been applied to anything yet, given that the
     * relevant message is only coming in now.
     * @private
     * @method ChatBox#findDanglingRetraction
     * @param { object } attrs - Attributes representing a received
     *  message, as returned by {@link parseMessage}
     * @returns { Message }
     */
    private findDanglingRetraction;
    /**
     * Handles message retraction based on the passed in attributes.
     * @method ChatBox#handleRetraction
     * @param {object} attrs - Attributes representing a received
     *  message, as returned by {@link parseMessage}
     * @returns {Promise<Boolean>} Returns `true` or `false` depending on
     *  whether a message was retracted or not.
     */
    handleRetraction(attrs: object): Promise<boolean>;
    /**
     * Returns an already cached message (if it exists) based on the
     * passed in attributes map.
     * @method ChatBox#getDuplicateMessage
     * @param {object} attrs - Attributes representing a received
     *  message, as returned by {@link parseMessage}
     * @returns {Message}
     */
    getDuplicateMessage(attrs: object): Message;
    getOriginIdQueryAttrs(attrs: any): {
        origin_id: any;
        from: any;
    };
    getStanzaIdQueryAttrs(attrs: any): {}[];
    getMessageBodyQueryAttrs(attrs: any): {
        from: any;
        msgid: any;
    };
    /**
     * Retract one of your messages in this chat
     * @method ChatBoxView#retractOwnMessage
     * @param { Message } message - The message which we're retracting.
     */
    retractOwnMessage(message: Message): void;
    /**
     * Sends a message stanza to retract a message in this chat
     * @private
     * @method ChatBox#sendRetractionMessage
     * @param { Message } message - The message which we're retracting.
     */
    private sendRetractionMessage;
    /**
     * Finds the last eligible message and then sends a XEP-0333 chat marker for it.
     * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
     * @param { Boolean } force - Whether a marker should be sent for the
     *  message, even if it didn't include a `markable` element.
     */
    sendMarkerForLastMessage(type?: ('received' | 'displayed' | 'acknowledged'), force?: boolean): void;
    /**
     * Given the passed in message object, send a XEP-0333 chat marker.
     * @param { Message } msg
     * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
     * @param { Boolean } force - Whether a marker should be sent for the
     *  message, even if it didn't include a `markable` element.
     */
    sendMarkerForMessage(msg: Message, type?: ('received' | 'displayed' | 'acknowledged'), force?: boolean): void;
    handleChatMarker(attrs: any): boolean;
    sendReceiptStanza(to_jid: any, id: any): void;
    handleReceipt(attrs: any): boolean;
    /**
     * Given a {@link Message} return the XML stanza that represents it.
     * @private
     * @method ChatBox#createMessageStanza
     * @param { Message } message - The message object
     */
    private createMessageStanza;
    getOutgoingMessageAttributes(attrs: any): Promise<any>;
    /**
     * Responsible for setting the editable attribute of messages.
     * If api.settings.get('allow_message_corrections') is "last", then only the last
     * message sent from me will be editable. If set to "all" all messages
     * will be editable. Otherwise no messages will be editable.
     * @method ChatBox#setEditable
     * @memberOf ChatBox
     * @param {Object} attrs An object containing message attributes.
     * @param {String} send_time - time when the message was sent
     */
    setEditable(attrs: any, send_time: string): void;
    /**
     * Queue the creation of a message, to make sure that we don't run
     * into a race condition whereby we're creating a new message
     * before the collection has been fetched.
     * @method ChatBox#createMessage
     * @param {Object} attrs
     */
    createMessage(attrs: any, options: any): Promise<any>;
    /**
     * Responsible for sending off a text message inside an ongoing chat conversation.
     * @method ChatBox#sendMessage
     * @memberOf ChatBox
     * @param {Object} [attrs] - A map of attributes to be saved on the message
     * @returns {Promise<Message>}
     * @example
     * const chat = api.chats.get('buddy1@example.org');
     * chat.sendMessage({'body': 'hello world'});
     */
    sendMessage(attrs?: any): Promise<Message>;
    /**
     * Sends a message with the current XEP-0085 chat state of the user
     * as taken from the `chat_state` attribute of the {@link ChatBox}.
     * @method ChatBox#sendChatState
     */
    sendChatState(): void;
    /**
     * @param {File[]} files
     */
    sendFiles(files: File[]): Promise<void>;
    /**
     * @param {boolean} force
     */
    maybeShow(force: boolean): ChatBox;
    /**
     * Indicates whether the chat is hidden and therefore
     * whether a newly received message will be visible
     * to the user or not.
     * @returns {boolean}
     */
    isHidden(): boolean;
    /**
     * Given a newly received {@link Message} instance,
     * update the unread counter if necessary.
     * @method ChatBox#handleUnreadMessage
     * @param {Message} message
     */
    handleUnreadMessage(message: Message): void;
    /**
     * @param {Message} message
     */
    incrementUnreadMsgsCounter(message: Message): void;
    clearUnreadMsgCounter(): void;
    isScrolledUp(): any;
}
import ModelWithContact from "./model-with-contact.js";
import { Model } from "@converse/skeletor";
//# sourceMappingURL=model.d.ts.map