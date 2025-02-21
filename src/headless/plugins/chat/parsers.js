/**
 * @module:plugin-chat-parsers
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import dayjs from 'dayjs';
import log from '../../log.js';
import u from '../../utils/index.js';
import { rejectMessage } from '../../shared/actions.js';
import { StanzaParseError } from '../../shared/errors.js';
import {
    getChatMarker,
    getChatState,
    getCorrectionAttributes,
    getEncryptionAttributes,
    getErrorAttributes,
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
} from '../../shared/parsers';

const { Strophe, sizzle } = converse.env;

/**
 * Parses a passed in message stanza and returns an object of attributes.
 * @param {Element} stanza - The message stanza
 * @returns {Promise<import('../../shared/types.ts').MessageAttributes|StanzaParseError>}
 */
export async function parseMessage (stanza) {
    throwErrorIfInvalidForward(stanza);

    let to_jid = stanza.getAttribute('to');
    const to_resource = Strophe.getResourceFromJid(to_jid);
    const resource = _converse.session.get('resource');
    if (api.settings.get('filter_by_resource') && to_resource && to_resource !== resource) {
        return new StanzaParseError(
            stanza,
            `Ignoring incoming message intended for a different resource: ${to_jid}`,
        );
    }

    const bare_jid = _converse.session.get('bare_jid');
    const original_stanza = stanza;
    let from_jid = stanza.getAttribute('from') || bare_jid;
    if (isCarbon(stanza)) {
        if (from_jid === bare_jid) {
            const selector = `[xmlns="${Strophe.NS.CARBONS}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
            stanza = sizzle(selector, stanza).pop();
            to_jid = stanza.getAttribute('to');
            from_jid = stanza.getAttribute('from');
        } else {
            // Prevent message forging via carbons: https://xmpp.org/extensions/xep-0280.html#security
            rejectMessage(stanza, 'Rejecting carbon from invalid JID');
            return new StanzaParseError(stanza, `Rejecting carbon from invalid JID ${to_jid}`);
        }
    }

    const is_archived = isArchived(stanza);
    if (is_archived) {
        if (from_jid === bare_jid) {
            const selector = `[xmlns="${Strophe.NS.MAM}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
            stanza = sizzle(selector, stanza).pop();
            to_jid = stanza.getAttribute('to');
            from_jid = stanza.getAttribute('from');
        } else {
            return new StanzaParseError(
                stanza,
                `Invalid Stanza: alleged MAM message from ${stanza.getAttribute('from')}`,
            );
        }
    }

    const from_bare_jid = Strophe.getBareJidFromJid(from_jid);
    const is_me = from_bare_jid === bare_jid;
    if (is_me && to_jid === null) {
        return new StanzaParseError(
            stanza,
            `Don't know how to handle message stanza without 'to' attribute. ${stanza.outerHTML}`,
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
                stanza,
                `Blocking messaging with a JID not in our roster because allow_non_roster_messaging is false.`,
            );
        }
    }
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
            'nick': contact?.attributes?.nickname,
            'receipt_id': getReceiptId(stanza),
            'received': new Date().toISOString(),
            'references': getReferences(stanza),
            'sender': is_me ? 'me' : 'them',
            'subject': stanza.querySelector('subject')?.textContent,
            'thread': stanza.querySelector('thread')?.textContent,
            'time': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : now,
            'to': stanza.getAttribute('to'),
            'type': stanza.getAttribute('type') || 'normal'
        },
        getErrorAttributes(stanza),
        getOutOfBandAttributes(stanza),
        getSpoilerAttributes(stanza),
        getCorrectionAttributes(stanza, original_stanza),
        getStanzaIDs(stanza, original_stanza),
        getRetractionAttributes(stanza, original_stanza),
        getEncryptionAttributes(stanza)
    );

    if (attrs.is_archived) {
        const from = original_stanza.getAttribute('from');
        if (from && from !== bare_jid) {
            return new StanzaParseError(stanza, `Invalid Stanza: Forged MAM message from ${from}`);
        }
    }
    attrs = Object.assign(
        {
            'message': attrs.body || attrs.error, // TODO: Remove and use body and error attributes instead
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
    return Object.assign(attrs, u.getMediaURLsMetadata(attrs.is_encrypted ? attrs.plaintext : attrs.body));
}
