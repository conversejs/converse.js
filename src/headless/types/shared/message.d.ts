export default BaseMessage;
/**
 * @extends {Model<import('./types').BaseMessageAttributes>}
 */
declare class BaseMessage extends Model<import("./types").BaseMessageAttributes> {
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
    ephemeral_timer: number;
    /**
     * Start the auto-destruct countdown for this ephemeral message.
     * Safe to call more than once; the running timer is reset each time.
     */
    startEphemeralTimer(): void;
    /**
     * Returns a boolean indicating whether this message is ephemeral,
     * meaning it will get automatically removed after ten seconds.
     * @returns {boolean | number}
     */
    isEphemeral(): boolean | number;
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
     * Returns the XEP-0359 stanza-id which the archive holding this message gave
     * it: the room's for a groupchat message, our account's otherwise.
     * @returns {string|undefined}
     */
    getArchiveID(): string | undefined;
    /**
     * Returns the id by which other messages refer to this one, such as
     * XEP-0461 replies and XEP-0444 reactions: in a groupchat the stanza-id
     * which the room gave it, elsewhere its own id.
     * @returns {string|undefined}
     */
    getReferenceID(): string | undefined;
    /**
     * Returns the XEP-0359 stanza-ids which `by_jid` assigned to all versions of
     * this message: first the original's, then those of its XEP-0308 corrections.
     * @param {string} by_jid - The JID of the entity which assigned the stanza-ids
     * @returns {string[]}
     */
    getStanzaIDs(by_jid: string): string[];
    /**
     * Whether the passed in message attributes have the stanza-id of a version
     * of this message, i.e. whether they represent this message or one of its
     * XEP-0308 corrections which we already have.
     * @param {import('./types').MessageAttributes} attrs
     * @returns {boolean}
     */
    hasStanzaIDOf(attrs: import("./types").MessageAttributes): boolean;
    /**
     * Given the attributes of a XEP-0308 correction of this message, returns the
     * stanza-ids of this message's corrections, including those of the given one.
     * @param {import('./types').MessageAttributes} attrs - The correction's attributes
     * @returns {Record<string, string[]>} The correction stanza-ids keyed by the assigning JID
     */
    getCorrectionStanzaIDs(attrs: import("./types").MessageAttributes): Record<string, string[]>;
    /**
     * Returns when the last thing that happened to this message happened:
     * when it was retracted, else when it was last edited, else when it was sent.
     * @returns {string}
     */
    getDisplayTime(): string;
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
     * Request an upload slot (XEP-0363 § 4) and record it on the message, which starts
     * the upload: saving `put` fires the `change:put` handler set up in `initialize`.
     *
     * The protocol itself lives in `http-upload.js`; what belongs here is reporting a
     * failure as an ephemeral error message in the conversation.
     */
    getRequestSlotURL(): Promise<any>;
    upload_metadata: {
        headers: import("./types").UploadSlotHeader[];
    };
    /**
     * PUT the file to the slot recorded by {@link getRequestSlotURL}, tracking progress
     * on the message so the UI can show a progress bar.
     *
     * Called off a `change:put` listener, so nothing awaits it: it has to settle its own
     * failures rather than reject.
     */
    uploadFile(): Promise<any>;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=message.d.ts.map