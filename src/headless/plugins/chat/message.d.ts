export default MessageMixin;
declare namespace MessageMixin {
    function defaults(): {
        msgid: any;
        time: string;
        is_ephemeral: boolean;
    };
    function initialize(): Promise<void>;
    function setContact(...args: any[]): void;
    /**
     * Sets an auto-destruct timer for this message, if it's is_ephemeral.
     * @private
     * @method _converse.Message#setTimerForEphemeralMessage
     */
    function setTimerForEphemeralMessage(): void;
    function checkValidity(): boolean;
    /**
     * Determines whether this messsage may be retracted by the current user.
     * @private
     * @method _converse.Messages#mayBeRetracted
     * @returns { Boolean }
     */
    function mayBeRetracted(): boolean;
    function safeDestroy(): void;
    /**
     * Returns a boolean indicating whether this message is ephemeral,
     * meaning it will get automatically removed after ten seconds.
     * @returns { boolean }
     */
    function isEphemeral(): boolean;
    /**
     * Returns a boolean indicating whether this message is a XEP-0245 /me command.
     * @returns { boolean }
     */
    function isMeCommand(): boolean;
    /**
     * Returns a boolean indicating whether this message is considered a followup
     * message from the previous one. Followup messages are shown grouped together
     * under one author heading.
     * A message is considered a followup of it's predecessor when it's a chat
     * message from the same author, within 10 minutes.
     * @returns { boolean }
     */
    function isFollowup(): boolean;
    function getDisplayName(): any;
    function getMessageText(): any;
    /**
     * Send out an IQ stanza to request a file upload slot.
     * https://xmpp.org/extensions/xep-0363.html#request
     * @private
     * @method _converse.Message#sendSlotRequestStanza
     */
    function sendSlotRequestStanza(): Promise<any>;
    function getUploadRequestMetadata(stanza: any): {
        headers: any;
    };
    function getRequestSlotURL(): Promise<any>;
    function uploadFile(): void;
}
