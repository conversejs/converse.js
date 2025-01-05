import {EncryptionAttrs} from "../../shared/types";

export type MessageErrorAttributes = {
    is_error: boolean; // Whether an error was received for this message
    error: string; // The error name
    errors: { name: string; xmlns: string }[];
    error_condition: string; // The defined error condition
    error_text: string; // The error text received from the server
    error_type: string; // The type of error received from the server
}

export type MessageAttributes = EncryptionAttrs & MessageErrorAttributes & {
    body: string; // The contents of the <body> tag of the message stanza
    chat_state: string; // The XEP-0085 chat state notification contained in this message
    contact_jid: string; // The JID of the other person or entity
    editable: boolean; // Is this message editable via XEP-0308?
    edited: string; // An ISO8601 string recording the time that the message was edited per XEP-0308
    from: string; // The sender JID
    message?: string; // Used with info and error messages
    fullname: string; // The full name of the sender
    is_archived: boolean; //  Is this message from a XEP-0313 MAM archive?
    is_carbon: boolean; // Is this message a XEP-0280 Carbon?
    is_delayed: boolean; // Was delivery of this message was delayed as per XEP-0203?
    is_encrypted: boolean; //  Is this message XEP-0384  encrypted?
    is_headline: boolean; // Is this a "headline" message?
    is_markable: boolean; // Can this message be marked with a XEP-0333 chat marker?
    is_marker: boolean; // Is this message a XEP-0333 Chat Marker?
    is_only_emojis: boolean; // Does the message body contain only emojis?
    is_spoiler: boolean; // Is this a XEP-0382 spoiler message?
    is_tombstone: boolean; // Is this a XEP-0424 tombstone?
    is_unstyled: boolean; // Whether XEP-0393 styling hints should be ignored
    is_valid_receipt_request: boolean; // Does this message request a XEP-0184 receipt (and is not from us or a carbon or archived message)
    marker: string; // The XEP-0333 Chat Marker value
    marker_id: string; // The `id` attribute of a XEP-0333 chat marker
    msgid: string; // The root `id` attribute of the stanza
    nick: string; // The roster nickname of the sender
    ogp_for_id?: string; // Used for Open Graph Metadata support for unfurls
    oob_desc: string; // The description of the XEP-0066 out of band data
    oob_url: string; // The URL of the XEP-0066 out of band data
    origin_id: string; // The XEP-0359 Origin ID
    plaintext: string; // The decrypted text of this message, in case it was encrypted.
    receipt_id: string; // The `id` attribute of a XEP-0184 <receipt> element
    received: string; // An ISO8601 string recording the time that the message was received
    references: Array<Object>; // A list of objects representing XEP-0372 references
    replace_id: string; // The `id` attribute of a XEP-0308 <replace> element
    retracted: string; // An ISO8601 string recording the time that the message was retracted
    retracted_id: string; // The `id` attribute of a XEP-424 <retracted> element
    sender: 'me' | 'them'; // Whether the message was sent by the current user or someone else
    spoiler_hint: string; //  The XEP-0382 spoiler hint
    stanza_id: string; // The XEP-0359 Stanza ID. Note: the key is actualy `stanza_id ${by_jid}` and there can be multiple.
    subject: string; // The <subject> element value
    thread: string; // The <thread> element value
    time: string; // The time (in ISO8601 format), either given by the XEP-0203 <delay> element, or of receipt.
    to: string; // The recipient JID
    type: string; // The type of message
};
