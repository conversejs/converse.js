export default Message;
export type Model = import('@converse/skeletor').Model;
/**
 * Represents a (non-MUC) message.
 * These can be either `chat`, `normal` or `headline` messages.
 * @namespace _converse.Message
 * @memberOf _converse
 * @example const msg = new Message({'message': 'hello world!'});
 */
declare class Message extends ModelWithContact {
    /**
     * @param {Model[]} [models]
     * @param {object} [options]
     */
    constructor(models?: Model[], options?: object);
    defaults(): {
        msgid: string;
        time: string;
        is_ephemeral: boolean;
    };
    file: any;
    initialize(): Promise<void>;
    initialized: any;
    setContact(...args: any[]): Promise<void>;
    /**
     * Sets an auto-destruct timer for this message, if it's is_ephemeral.
     * @method _converse.Message#setTimerForEphemeralMessage
     */
    setTimerForEphemeralMessage(): void;
    ephemeral_timer: NodeJS.Timeout;
    checkValidity(): boolean;
    /**
     * Determines whether this messsage may be retracted by the current user.
     * @method _converse.Messages#mayBeRetracted
     * @returns { Boolean }
     */
    mayBeRetracted(): boolean;
    safeDestroy(): void;
    /**
     * Returns a boolean indicating whether this message is ephemeral,
     * meaning it will get automatically removed after ten seconds.
     * @returns { boolean }
     */
    isEphemeral(): boolean;
    /**
     * Returns a boolean indicating whether this message is a XEP-0245 /me command.
     * @returns { boolean }
     */
    isMeCommand(): boolean;
    /**
     * Returns a boolean indicating whether this message is considered a followup
     * message from the previous one. Followup messages are shown grouped together
     * under one author heading.
     * A message is considered a followup of it's predecessor when it's a chat
     * message from the same author, within 10 minutes.
     * @returns { boolean }
     */
    isFollowup(): boolean;
    getDisplayName(): any;
    getMessageText(): any;
    /**
     * Send out an IQ stanza to request a file upload slot.
     * https://xmpp.org/extensions/xep-0363.html#request
     * @private
     * @method _converse.Message#sendSlotRequestStanza
     */
    private sendSlotRequestStanza;
    getUploadRequestMetadata(stanza: any): {
        headers: any;
    };
    getRequestSlotURL(): Promise<any>;
    upload_metadata: {
        headers: any;
    };
    uploadFile(): void;
}
import ModelWithContact from "./model-with-contact.js";
//# sourceMappingURL=message.d.ts.map