import dayjs from 'dayjs';
import log from '@converse/headless/log';
import u from '@converse/headless/utils/core';
import { api, converse } from '@converse/headless/core';
import { rejectMessage } from '@converse/headless/shared/actions';

import {
    StanzaParseError,
    getChatMarker,
    getChatState,
    getCorrectionAttributes,
    getEncryptionAttributes,
    getErrorAttributes,
    getMediaURLsMetadata,
    getOutOfBandAttributes,
    getReceiptId,
    getReferences,
    getRetractionAttributes,
    getSpoilerAttributes,
    getStanzaIDs,
    isArchived,
    isCarbon,
    isHeadline,
    isServerMessage,
    isValidReceiptRequest,
    throwErrorIfInvalidForward,
} from '@converse/headless/shared/parsers';

const { Strophe, sizzle } = converse.env;


/**
 * Parses a passed in message stanza and returns an object of attributes.
 * @method st#parseMessage
 * @param { XMLElement } stanza - The message stanza
 * @param { _converse } _converse
 * @returns { (MessageAttributes|Error) }
 */
export async function parseMessage (stanza, _converse) {
    throwErrorIfInvalidForward(stanza);

    let to_jid = stanza.getAttribute('to');
    const to_resource = Strophe.getResourceFromJid(to_jid);
    if (api.settings.get('filter_by_resource') && to_resource && to_resource !== _converse.resource) {
        return new StanzaParseError(
            `Ignoring incoming message intended for a different resource: ${to_jid}`,
            stanza
        );
    }

    const original_stanza = stanza;
    let from_jid = stanza.getAttribute('from') || _converse.bare_jid;
    if (isCarbon(stanza)) {
        if (from_jid === _converse.bare_jid) {
            const selector = `[xmlns="${Strophe.NS.CARBONS}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
            stanza = sizzle(selector, stanza).pop();
            to_jid = stanza.getAttribute('to');
            from_jid = stanza.getAttribute('from');
        } else {
            // Prevent message forging via carbons: https://xmpp.org/extensions/xep-0280.html#security
            rejectMessage(stanza, 'Rejecting carbon from invalid JID');
            return new StanzaParseError(`Rejecting carbon from invalid JID ${to_jid}`, stanza);
        }
    }

    const is_archived = isArchived(stanza);
    if (is_archived) {
        if (from_jid === _converse.bare_jid) {
            const selector = `[xmlns="${Strophe.NS.MAM}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
            stanza = sizzle(selector, stanza).pop();
            to_jid = stanza.getAttribute('to');
            from_jid = stanza.getAttribute('from');
        } else {
            return new StanzaParseError(
                `Invalid Stanza: alleged MAM message from ${stanza.getAttribute('from')}`,
                stanza
            );
        }
    }

    const from_bare_jid = Strophe.getBareJidFromJid(from_jid);
    const is_me = from_bare_jid === _converse.bare_jid;
    if (is_me && to_jid === null) {
        return new StanzaParseError(
            `Don't know how to handle message stanza without 'to' attribute. ${stanza.outerHTML}`,
            stanza
        );
    }

    const is_headline = isHeadline(stanza);
    const is_server_message = isServerMessage(stanza);
    let contact, contact_jid;
    if (!is_headline && !is_server_message) {
        contact_jid = is_me ? Strophe.getBareJidFromJid(to_jid) : from_bare_jid;
        contact = await api.contacts.get(contact_jid);
        if (contact === undefined && !api.settings.get('allow_non_roster_messaging')) {
            log.error(stanza);
            return new StanzaParseError(
                `Blocking messaging with a JID not in our roster because allow_non_roster_messaging is false.`,
                stanza
            );
        }
    }
    /**
     * @typedef { Object } MessageAttributes
     * The object which {@link parseMessage} returns
     * @property { ('me'|'them') } sender - Whether the message was sent by the current user or someone else
     * @property { Array<Object> } references - A list of objects representing XEP-0372 references
     * @property { Boolean } editable - Is this message editable via XEP-0308?
     * @property { Boolean } is_archived -  Is this message from a XEP-0313 MAM archive?
     * @property { Boolean } is_carbon - Is this message a XEP-0280 Carbon?
     * @property { Boolean } is_delayed - Was delivery of this message was delayed as per XEP-0203?
     * @property { Boolean } is_encrypted -  Is this message XEP-0384  encrypted?
     * @property { Boolean } is_error - Whether an error was received for this message
     * @property { Boolean } is_headline - Is this a "headline" message?
     * @property { Boolean } is_markable - Can this message be marked with a XEP-0333 chat marker?
     * @property { Boolean } is_marker - Is this message a XEP-0333 Chat Marker?
     * @property { Boolean } is_only_emojis - Does the message body contain only emojis?
     * @property { Boolean } is_spoiler - Is this a XEP-0382 spoiler message?
     * @property { Boolean } is_tombstone - Is this a XEP-0424 tombstone?
     * @property { Boolean } is_unstyled - Whether XEP-0393 styling hints should be ignored
     * @property { Boolean } is_valid_receipt_request - Does this message request a XEP-0184 receipt (and is not from us or a carbon or archived message)
     * @property { Object } encrypted -  XEP-0384 encryption payload attributes
     * @property { String } body - The contents of the <body> tag of the message stanza
     * @property { String } chat_state - The XEP-0085 chat state notification contained in this message
     * @property { String } contact_jid - The JID of the other person or entity
     * @property { String } edited - An ISO8601 string recording the time that the message was edited per XEP-0308
     * @property { String } error_condition - The defined error condition
     * @property { String } error_text - The error text received from the server
     * @property { String } error_type - The type of error received from the server
     * @property { String } from - The sender JID
     * @property { String } fullname - The full name of the sender
     * @property { String } marker - The XEP-0333 Chat Marker value
     * @property { String } marker_id - The `id` attribute of a XEP-0333 chat marker
     * @property { String } msgid - The root `id` attribute of the stanza
     * @property { String } nick - The roster nickname of the sender
     * @property { String } oob_desc - The description of the XEP-0066 out of band data
     * @property { String } oob_url - The URL of the XEP-0066 out of band data
     * @property { String } origin_id - The XEP-0359 Origin ID
     * @property { String } receipt_id - The `id` attribute of a XEP-0184 <receipt> element
     * @property { String } received - An ISO8601 string recording the time that the message was received
     * @property { String } replace_id - The `id` attribute of a XEP-0308 <replace> element
     * @property { String } retracted - An ISO8601 string recording the time that the message was retracted
     * @property { String } retracted_id - The `id` attribute of a XEP-424 <retracted> element
     * @property { String } spoiler_hint  The XEP-0382 spoiler hint
     * @property { String } stanza_id - The XEP-0359 Stanza ID. Note: the key is actualy `stanza_id ${by_jid}` and there can be multiple.
     * @property { String } subject - The <subject> element value
     * @property { String } thread - The <thread> element value
     * @property { String } time - The time (in ISO8601 format), either given by the XEP-0203 <delay> element, or of receipt.
     * @property { String } to - The recipient JID
     * @property { String } type - The type of message
     */
    const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
    const marker = getChatMarker(stanza);
    const now = new Date().toISOString();
    let attrs = Object.assign(
        {
            contact_jid,
            is_archived,
            is_headline,
            is_server_message,
            'body': stanza.querySelector('body')?.textContent?.trim(),
            'chat_state': getChatState(stanza),
            'from': Strophe.getBareJidFromJid(stanza.getAttribute('from')),
            'is_carbon': isCarbon(original_stanza),
            'is_delayed': !!delay,
            'is_markable': !!sizzle(`markable[xmlns="${Strophe.NS.MARKERS}"]`, stanza).length,
            'is_marker': !!marker,
            'is_unstyled': !!sizzle(`unstyled[xmlns="${Strophe.NS.STYLING}"]`, stanza).length,
            'marker_id': marker && marker.getAttribute('id'),
            'msgid': stanza.getAttribute('id') || original_stanza.getAttribute('id'),
            'nick': contact?.attributes?.nickname,
            'receipt_id': getReceiptId(stanza),
            'received': new Date().toISOString(),
            'references': getReferences(stanza),
            'sender': is_me ? 'me' : 'them',
            'subject': stanza.querySelector('subject')?.textContent,
            'thread': stanza.querySelector('thread')?.textContent,
            'time': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : now,
            'to': stanza.getAttribute('to'),
            'type': stanza.getAttribute('type')
        },
        getErrorAttributes(stanza),
        getOutOfBandAttributes(stanza),
        getSpoilerAttributes(stanza),
        getCorrectionAttributes(stanza, original_stanza),
        getStanzaIDs(stanza, original_stanza),
        getRetractionAttributes(stanza, original_stanza),
        getEncryptionAttributes(stanza, _converse)
    );

    if (attrs.is_archived) {
        const from = original_stanza.getAttribute('from');
        if (from && from !== _converse.bare_jid) {
            return new StanzaParseError(`Invalid Stanza: Forged MAM message from ${from}`, stanza);
        }
    }
    await api.emojis.initialize();
    attrs = Object.assign(
        {
            'message': attrs.body || attrs.error, // TODO: Remove and use body and error attributes instead
            'is_only_emojis': attrs.body ? u.isOnlyEmojis(attrs.body) : false,
            'is_valid_receipt_request': isValidReceiptRequest(stanza, attrs)
        },
        attrs
    );

    // We prefer to use one of the XEP-0359 unique and stable stanza IDs
    // as the Model id, to avoid duplicates.
    attrs['id'] = attrs['origin_id'] || attrs[`stanza_id ${attrs.from}`] || u.getUniqueId();

    /**
     * *Hook* which allows plugins to add additional parsing
     * @event _converse#parseMessage
     */
    attrs = await api.hook('parseMessage', stanza, attrs);

    // We call this after the hook, to allow plugins (like omemo) to decrypt encrypted
    // messages, since we need to parse the message text to determine whether
    // there are media urls.
    return Object.assign(attrs, getMediaURLsMetadata(attrs.is_encrypted ? attrs.plaintext : attrs.body));
}
