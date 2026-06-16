export default BaseMessage;
/**
 * @extends {Model}
 */
declare class BaseMessage extends Model<import("@converse/skeletor").ModelAttributes> {
    /**
     * @param {import('./types').MessageAttributes} attrs
     * @param {import('@converse/skeletor').ModelOptions} options
     */
    constructor(attrs: import("./types").MessageAttributes, options: import("@converse/skeletor").ModelOptions);
    defaults(): {
        msgid: string;
        time: string;
        is_ephemeral: boolean;
    };
    file: any;
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
     * Start the auto-destruct countdown for this ephemeral message.
     * Safe to call more than once; the running timer is reset each time.
     */
    startEphemeralTimer(): void;
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
    getMessageText(): string;
    /**
     * Strip the XEP-0461 compatibility fallback — the `>`-quoted copy of the
     * replied-to message — from `text`. Converse renders the reply context from
     * the structured `<reply>`, so per XEP-0461 it must not also show the quoted
     * fallback. Offsets are XEP-0426 Unicode code points, so we slice on the
     * code-point array rather than UTF-16 units.
     * @param {string} text
     * @returns {string}
     */
    stripReplyFallback(text: string): string;
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