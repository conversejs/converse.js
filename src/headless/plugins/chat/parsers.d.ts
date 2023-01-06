/**
 * Parses a passed in message stanza and returns an object of attributes.
 * @method st#parseMessage
 * @param { Element } stanza - The message stanza
 * @param { _converse } _converse
 * @returns { (MessageAttributes|Error) }
 */
export function parseMessage(stanza: Element): Error | {
    /**
     * - Whether the message was sent by the current user or someone else
     */
    sender: ('me' | 'them');
    /**
     * - A list of objects representing XEP-0372 references
     */
    references: Array<any>;
    /**
     * - Is this message editable via XEP-0308?
     */
    editable: boolean;
    /**
     * -  Is this message from a XEP-0313 MAM archive?
     */
    is_archived: boolean;
    /**
     * - Is this message a XEP-0280 Carbon?
     */
    is_carbon: boolean;
    /**
     * - Was delivery of this message was delayed as per XEP-0203?
     */
    is_delayed: boolean;
    /**
     * -  Is this message XEP-0384  encrypted?
     */
    is_encrypted: boolean;
    /**
     * - Whether an error was received for this message
     */
    is_error: boolean;
    /**
     * - Is this a "headline" message?
     */
    is_headline: boolean;
    /**
     * - Can this message be marked with a XEP-0333 chat marker?
     */
    is_markable: boolean;
    /**
     * - Is this message a XEP-0333 Chat Marker?
     */
    is_marker: boolean;
    /**
     * - Does the message body contain only emojis?
     */
    is_only_emojis: boolean;
    /**
     * - Is this a XEP-0382 spoiler message?
     */
    is_spoiler: boolean;
    /**
     * - Is this a XEP-0424 tombstone?
     */
    is_tombstone: boolean;
    /**
     * - Whether XEP-0393 styling hints should be ignored
     */
    is_unstyled: boolean;
    /**
     * - Does this message request a XEP-0184 receipt (and is not from us or a carbon or archived message)
     */
    is_valid_receipt_request: boolean;
    /**
     * -  XEP-0384 encryption payload attributes
     */
    encrypted: any;
    /**
     * - The contents of the <body> tag of the message stanza
     */
    body: string;
    /**
     * - The XEP-0085 chat state notification contained in this message
     */
    chat_state: string;
    /**
     * - The JID of the other person or entity
     */
    contact_jid: string;
    /**
     * - An ISO8601 string recording the time that the message was edited per XEP-0308
     */
    edited: string;
    /**
     * - The defined error condition
     */
    error_condition: string;
    /**
     * - The error text received from the server
     */
    error_text: string;
    /**
     * - The type of error received from the server
     */
    error_type: string;
    /**
     * - The sender JID
     */
    from: string;
    /**
     * - The full name of the sender
     */
    fullname: string;
    /**
     * - The XEP-0333 Chat Marker value
     */
    marker: string;
    /**
     * - The `id` attribute of a XEP-0333 chat marker
     */
    marker_id: string;
    /**
     * - The root `id` attribute of the stanza
     */
    msgid: string;
    /**
     * - The roster nickname of the sender
     */
    nick: string;
    /**
     * - The description of the XEP-0066 out of band data
     */
    oob_desc: string;
    /**
     * - The URL of the XEP-0066 out of band data
     */
    oob_url: string;
    /**
     * - The XEP-0359 Origin ID
     */
    origin_id: string;
    /**
     * - The `id` attribute of a XEP-0184 <receipt> element
     */
    receipt_id: string;
    /**
     * - An ISO8601 string recording the time that the message was received
     */
    received: string;
    /**
     * - The `id` attribute of a XEP-0308 <replace> element
     */
    replace_id: string;
    /**
     * - An ISO8601 string recording the time that the message was retracted
     */
    retracted: string;
    /**
     * - The `id` attribute of a XEP-424 <retracted> element
     */
    retracted_id: string;
    /**
     * The XEP-0382 spoiler hint
     */
    spoiler_hint: string;
    /**
     * - The XEP-0359 Stanza ID. Note: the key is actualy `stanza_id ${by_jid}` and there can be multiple.
     */
    stanza_id: string;
    /**
     * - The <subject> element value
     */
    subject: string;
    /**
     * - The <thread> element value
     */
    thread: string;
    /**
     * - The time (in ISO8601 format), either given by the XEP-0203 <delay> element, or of receipt.
     */
    time: string;
    /**
     * - The recipient JID
     */
    to: string;
    /**
     * - The type of message
     */
    type: string;
};
