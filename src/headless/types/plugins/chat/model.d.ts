export default ChatBox;
declare const ChatBox_base: typeof ChatBoxBase & import("../../shared/types").Constructor<import("../../shared/types").ColorAware> & import("../../shared/types").Constructor<import("../../shared/types").ContactAware> & import("../../shared/types").Constructor<import("../../shared/types").MessagesAware> & import("../../shared/types").Constructor<import("../../shared/types").VCardAware>;
/**
 * Represents a one-on-one chat conversation.
 */
declare class ChatBox extends ChatBox_base {
    /**
     * @param {import('@converse/skeletor').ModelAttributes} attrs
     * @param {import('@converse/skeletor').ModelOptions} options
     */
    constructor(attrs: import("@converse/skeletor").ModelAttributes, options: import("@converse/skeletor").ModelOptions);
    /**
     * @typedef {import('./message.js').default} Message
     * @typedef {import('../muc/muc.js').default} MUC
     * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
     * @typedef {import('../../shared/errors').StanzaParseError} StanzaParseError
     */
    defaults(): {
        hidden: boolean;
        message_type: string;
        num_unread: number;
        time_opened: any;
        time_sent: string;
        type: string;
    };
    initialized: Promise<void>;
    setup(): Promise<void>;
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
     * @param {string} jid1
     * @param {string} jid2
     */
    isSameUser(jid1: string, jid2: string): any;
    /**
     * @param {MessageAttributes} attrs
     */
    handleChatMarker(attrs: import("../../shared/types").MessageAttributes): boolean;
}
import ChatBoxBase from '../../shared/chatbox.js';
//# sourceMappingURL=model.d.ts.map