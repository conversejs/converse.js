/**
 * @module:plugin-muc-parsers
 * @typedef {import('../muc/muc.js').default} MUC
 * @typedef {import('./types').MUCMessageAttributes} MUCMessageAttributes
 */
import dayjs from 'dayjs';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { StanzaParseError } from '../../shared/errors.js';
import {
    getChatMarker,
    getChatState,
    getCorrectionAttributes,
    getEncryptionAttributes,
    getErrorAttributes,
    getOpenGraphMetadata,
    getOutOfBandAttributes,
    getReceiptId,
    getReferences,
    getRetractionAttributes,
    getSpoilerAttributes,
    getStanzaIDs,
    isArchived,
    isCarbon,
    isHeadline,
    isValidReceiptRequest,
    throwErrorIfInvalidForward,
} from '../../shared/parsers';

const { Strophe, sizzle, u } = converse.env;
const { NS } = Strophe;

/**
 * Parses a message stanza for XEP-0316 MEP notification data
 * @param {Element} stanza - The message stanza
 * @returns {Array} Returns an array of objects representing <activity> elements.
 */
export function getMEPActivities (stanza) {
    const items_el = sizzle(`items[node="${Strophe.NS.CONFINFO}"]`, stanza).pop();
    if (!items_el) {
        return null;
    }
    const from = stanza.getAttribute('from');
    const msgid = stanza.getAttribute('id');
    const selector = `item `+
        `conference-info[xmlns="${Strophe.NS.CONFINFO}"] `+
        `activity[xmlns="${Strophe.NS.ACTIVITY}"]`;
    return sizzle(selector, items_el).map(/** @param {Element} el */(el) => {
        const message = el.querySelector('text')?.textContent;
        if (message) {
            const references = getReferences(stanza);
            const reason = el.querySelector('reason')?.textContent;
            return { from, msgid, message, reason,  references, 'type': 'mep' };
        }
        return {};
    });
}

/**
 * Given a MUC stanza, check whether it has extended message information that
 * includes the sender's real JID, as described here:
 * https://xmpp.org/extensions/xep-0313.html#business-storeret-muc-archives
 *
 * If so, parse and return that data and return the user's JID
 *
 * Note, this function doesn't check whether this is actually a MAM archived stanza.
 *
 * @param {Element} stanza - The message stanza
 * @returns {Object}
 */
function getJIDFromMUCUserData (stanza) {
    const item = sizzle(`x[xmlns="${Strophe.NS.MUC_USER}"] item`, stanza).pop();
    return item?.getAttribute('jid');
}

/**
 * @param {Element} stanza - The message stanza
 *  message stanza, if it was contained, otherwise it's the message stanza itself.
 * @returns {Object}
 */
function getModerationAttributes (stanza) {
    const fastening = sizzle(`apply-to[xmlns="${Strophe.NS.FASTEN}"]`, stanza).pop();
    if (fastening) {
        const applies_to_id = fastening.getAttribute('id');
        const moderated = sizzle(`moderated[xmlns="${Strophe.NS.MODERATE}"]`, fastening).pop();
        if (moderated) {
            const retracted = sizzle(`retract[xmlns="${Strophe.NS.RETRACT}"]`, moderated).pop();
            if (retracted) {
                return {
                    'editable': false,
                    'moderated': 'retracted',
                    'moderated_by': moderated.getAttribute('by'),
                    'moderated_id': applies_to_id,
                    'moderation_reason': moderated.querySelector('reason')?.textContent
                };
            }
        }
    } else {
        const tombstone = sizzle(`> moderated[xmlns="${Strophe.NS.MODERATE}"]`, stanza).pop();
        if (tombstone) {
            const retracted = sizzle(`retracted[xmlns="${Strophe.NS.RETRACT}"]`, tombstone).pop();
            if (retracted) {
                return {
                    'editable': false,
                    'is_tombstone': true,
                    'moderated_by': tombstone.getAttribute('by'),
                    'retracted': tombstone.getAttribute('stamp'),
                    'moderation_reason': tombstone.querySelector('reason')?.textContent
                };
            }
        }
    }
    return {};
}

/**
 * @param {Element} stanza
 * @param {MUC} chatbox
 */
function getOccupantID (stanza, chatbox) {
    if (chatbox.features.get(Strophe.NS.OCCUPANTID)) {
        return sizzle(`occupant-id[xmlns="${Strophe.NS.OCCUPANTID}"]`, stanza).pop()?.getAttribute('id');
    }
}

/**
 * Determines whether the sender of this MUC message is the current user or
 * someone else.
 * @param {MUCMessageAttributes} attrs
 * @param {MUC} chatbox
 * @returns {'me'|'them'}
 */
function getSender (attrs, chatbox) {
    let is_me;
    const own_occupant_id = chatbox.get('occupant_id');

    if (own_occupant_id) {
        is_me = attrs.occupant_id === own_occupant_id;
    } else if (attrs.from_real_jid) {
        const bare_jid = _converse.session.get('bare_jid');
        is_me = Strophe.getBareJidFromJid(attrs.from_real_jid) === bare_jid;
    } else {
        is_me = attrs.nick === chatbox.get('nick')
    }
    return is_me ? 'me' : 'them';
}

/**
 * Parses a passed in message stanza and returns an object of attributes.
 * @param {Element} stanza - The message stanza
 * @param {MUC} chatbox
 * @returns {Promise<MUCMessageAttributes|StanzaParseError>}
 */
export async function parseMUCMessage (stanza, chatbox) {
    throwErrorIfInvalidForward(stanza);

    const selector = `[xmlns="${NS.MAM}"] > forwarded[xmlns="${NS.FORWARD}"] > message`;
    const original_stanza = stanza;
    stanza = sizzle(selector, stanza).pop() || stanza;

    if (sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).length) {
        return new StanzaParseError(
            stanza,
            `Invalid Stanza: Forged MAM groupchat message from ${stanza.getAttribute('from')}`,
        );
    }
    const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
    const from = stanza.getAttribute('from');
    const marker = getChatMarker(stanza);

    let attrs = /** @type {MUCMessageAttributes} */(Object.assign(
        {
            from,
            'activities': getMEPActivities(stanza),
            'body': stanza.querySelector(':scope > body')?.textContent?.trim(),
            'chat_state': getChatState(stanza),
            'from_muc': Strophe.getBareJidFromJid(from),
            'is_archived': isArchived(original_stanza),
            'is_carbon': isCarbon(original_stanza),
            'is_delayed': !!delay,
            'is_forwarded': !!stanza.querySelector('forwarded'),
            'is_headline': isHeadline(stanza),
            'is_markable': !!sizzle(`markable[xmlns="${Strophe.NS.MARKERS}"]`, stanza).length,
            'is_marker': !!marker,
            'is_unstyled': !!sizzle(`unstyled[xmlns="${Strophe.NS.STYLING}"]`, stanza).length,
            'marker_id': marker && marker.getAttribute('id'),
            'msgid': stanza.getAttribute('id') || original_stanza.getAttribute('id'),
            'nick': Strophe.unescapeNode(Strophe.getResourceFromJid(from)),
            'occupant_id': getOccupantID(stanza, chatbox),
            'receipt_id': getReceiptId(stanza),
            'received': new Date().toISOString(),
            'references': getReferences(stanza),
            'subject': stanza.querySelector('subject')?.textContent,
            'thread': stanza.querySelector('thread')?.textContent,
            'time': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : new Date().toISOString(),
            'to': stanza.getAttribute('to'),
            'type': stanza.getAttribute('type')
        },
        getErrorAttributes(stanza),
        getOutOfBandAttributes(stanza),
        getSpoilerAttributes(stanza),
        getCorrectionAttributes(stanza, original_stanza),
        getStanzaIDs(stanza, original_stanza),
        getOpenGraphMetadata(stanza),
        getRetractionAttributes(stanza, original_stanza),
        getModerationAttributes(stanza),
        getEncryptionAttributes(stanza),
    ));

    attrs.from_real_jid = attrs.is_archived && getJIDFromMUCUserData(stanza) ||
        chatbox.occupants.findOccupant(attrs)?.get('jid');

    attrs = Object.assign({
        'is_valid_receipt_request': isValidReceiptRequest(stanza, attrs),
        'message': attrs.body || attrs.error, // TODO: Should only be used for error and info messages
        'sender': getSender(attrs, chatbox),
    }, attrs);

    if (attrs.is_archived && original_stanza.getAttribute('from') !== attrs.from_muc) {
        return new StanzaParseError(
            stanza,
            `Invalid Stanza: Forged MAM message from ${original_stanza.getAttribute('from')}`,
        );
    } else if (attrs.is_archived && original_stanza.getAttribute('from') !== chatbox.get('jid')) {
        return new StanzaParseError(
            stanza,
            `Invalid Stanza: Forged MAM groupchat message from ${stanza.getAttribute('from')}`,
        );
    } else if (attrs.is_carbon) {
        return new StanzaParseError(stanza, 'Invalid Stanza: MUC messages SHOULD NOT be XEP-0280 carbon copied');
    }

    // We prefer to use one of the XEP-0359 unique and stable stanza IDs as the Model id, to avoid duplicates.
    attrs['id'] = attrs['origin_id'] || attrs[`stanza_id ${attrs.from_muc || attrs.from}`] || u.getUniqueId();

    /**
     * *Hook* which allows plugins to add additional parsing
     * @event _converse#parseMUCMessage
     */
    attrs = await api.hook('parseMUCMessage', stanza, attrs);

    // We call this after the hook, to allow plugins to decrypt encrypted
    // messages, since we need to parse the message text to determine whether
    // there are media urls.
    return Object.assign(attrs, u.getMediaURLsMetadata(attrs.is_encrypted ? attrs.plaintext : attrs.body));
}

/**
 * Given an IQ stanza with a member list, create an array of objects containing
 * known member data (e.g. jid, nick, role, affiliation).
 *
 * @param {Element} iq
 * @returns {import('./types').MemberListItem[]}
 */
export function parseMemberListIQ (iq) {
    return sizzle(`query[xmlns="${Strophe.NS.MUC_ADMIN}"] item`, iq).map(
        /** @param {Element} item */ (item) => {
            const data = {
                'affiliation': item.getAttribute('affiliation'),
            };
            const jid = item.getAttribute('jid');
            if (u.isValidJID(jid)) {
                data['jid'] = jid;
            } else {
                // XXX: Prosody sends nick for the jid attribute value
                // Perhaps for anonymous room?
                data['nick'] = jid;
            }
            const nick = item.getAttribute('nick');
            if (nick) {
                data['nick'] = nick;
            }
            const role = item.getAttribute('role');
            if (role) {
                data['role'] = nick;
            }
            return data;
        }
    );
}

/**
 * Parses a passed in MUC presence stanza and returns an object of attributes.
 * @param {Element} stanza - The presence stanza
 * @param {MUC} chatbox
 * @returns {import('./types').MUCPresenceAttributes}
 */
export function parseMUCPresence (stanza, chatbox) {
    const from = stanza.getAttribute('from');
    const type = stanza.getAttribute('type');
    const data = {
        'is_me': !!stanza.querySelector("status[code='110']"),
        'from': from,
        'occupant_id': getOccupantID(stanza, chatbox),
        'nick': Strophe.getResourceFromJid(from),
        'type': type,
        'states': [],
        'hats': [],
        'show': type !== 'unavailable' ? 'online' : 'offline'
    };

    Array.from(stanza.children).forEach(child => {
        if (child.matches('status')) {
            data.status = child.textContent || null;
        } else if (child.matches('show')) {
            data.show = child.textContent || 'online';
        } else if (child.matches('x') && child.getAttribute('xmlns') === Strophe.NS.MUC_USER) {
            Array.from(child.children).forEach(item => {
                if (item.nodeName === 'item') {
                    data.affiliation = item.getAttribute('affiliation');
                    data.role = item.getAttribute('role');
                    data.jid = item.getAttribute('jid');
                    data.nick = item.getAttribute('nick') || data.nick;
                } else if (item.nodeName == 'status' && item.getAttribute('code')) {
                    data.states.push(item.getAttribute('code'));
                }
            });
        } else if (child.matches('x') && child.getAttribute('xmlns') === Strophe.NS.VCARDUPDATE) {
            data.image_hash = child.querySelector('photo')?.textContent;
        } else if (child.matches('hats') && child.getAttribute('xmlns') === Strophe.NS.MUC_HATS) {
            data['hats'] = Array.from(child.children).map(
                c =>
                    c.matches('hat') && {
                        'title': c.getAttribute('title'),
                        'uri': c.getAttribute('uri')
                    }
            );
        }
    });
    return data;
}
