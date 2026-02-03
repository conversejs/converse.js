export default BaseMessage;
/**
 * @extends {Model}
 */
declare class BaseMessage extends Model<import("@converse/skeletor").ModelAttributes> {
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
    /** @type {import('./types').MessageAttributes} */
    attributes: import("./types").MessageAttributes;
    initialize(): void;
    lazy_load_vcard: boolean;
    chatbox: any;
    checkValidity(): boolean;
    safeDestroy(): void;
    /**
     * Sets an auto-destruct timer for this message, if it's is_ephemeral.
     */
    setTimerForEphemeralMessage(): void;
    ephemeral_timer: NodeJS.Timeout;
    /**
     * Returns a boolean indicating whether this message is ephemeral,
     * meaning it will get automatically removed after ten seconds.
     * @returns {boolean}
     */
    isEphemeral(): boolean;
    /**
     * Returns a boolean indicating whether this message is a XEP-0245 /me command.
     * @returns {boolean}
     */
    isMeCommand(): boolean;
    /**
     * @returns {boolean}
     */
    isRetracted(): boolean;
    /**
     * Returns a boolean indicating whether this message is considered a followup
     * message from the previous one. Followup messages are shown grouped together
     * under one author heading.
     * A message is considered a followup of it's predecessor when it's a chat
     * message from the same author, within 10 minutes.
     * @returns {boolean}
     */
    isFollowup(): boolean;
    /**
     * Determines whether this message may be retracted by the current user.
     * @returns { Boolean }
     */
    mayBeRetracted(): boolean;
    getMessageText(): any;
    /**
     * Send out an IQ stanza to request a file upload slot.
     * https://xmpp.org/extensions/xep-0363.html#request
     */
    sendSlotRequestStanza(): any;
    /**
     * @param {Element} stanza
     */
    getUploadRequestMetadata(stanza: Element): {
        headers: {
            name: string;
            value: string;
        }[];
    };
    getRequestSlotURL(): Promise<any>;
    upload_metadata: {
        headers: {
            name: string;
            value: string;
        }[];
    };
    uploadFile(): void;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=message.d.ts.map