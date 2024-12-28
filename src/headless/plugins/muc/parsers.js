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
import { STATUS_CODE_STANZAS } from './constants.js';

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
    const item = sizzle(`message > x[xmlns="${Strophe.NS.MUC_USER}"] item`, stanza).pop();
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
 * @param {'presence'|'message'} type
 * @returns {{codes: Array<import('./types').MUCStatusCode>, is_self: boolean}}
 */
function getStatusCodes(stanza, type) {
    /**
     * @typedef {import('./types').MUCStatusCode} MUCStatusCode
     */
    const codes = sizzle(`${type} > x[xmlns="${Strophe.NS.MUC_USER}"] status`, stanza)
        .map(/** @param {Element} s */ (s) => s.getAttribute('code'))
        .filter(
            /** @param {MUCStatusCode} c */
            (c) => STATUS_CODE_STANZAS[c]?.includes(type));

    if (type === 'presence' && codes.includes('333') && codes.includes('307')) {
        // See: https://github.com/xsf/xeps/pull/969/files#diff-ac5113766e59219806793c1f7d967f1bR4966
        codes.splice(codes.indexOf('307'), 1);
    }

    return {
        codes,
        is_self: codes.includes('110')
    };
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
 * @param {Element} original_stanza - The message stanza
 * @param {MUC} chatbox
 * @returns {Promise<MUCMessageAttributes|StanzaParseError>}
 */
export async function parseMUCMessage (original_stanza, chatbox) {
    throwErrorIfInvalidForward(original_stanza);

    const forwarded_stanza = sizzle(
        `result[xmlns="${NS.MAM}"] > forwarded[xmlns="${NS.FORWARD}"] > message`,
        original_stanza
    ).pop();

    const stanza = forwarded_stanza || original_stanza;
    if (sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).length) {
        return new StanzaParseError(
            stanza,
            `Invalid Stanza: Forged MAM groupchat message from ${stanza.getAttribute('from')}`,
        );
    }

    let delay;
    let body;

    if (forwarded_stanza) {
        if (sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, forwarded_stanza).length) {
            return new StanzaParseError(
                original_stanza,
                `Invalid Stanza: Forged MAM groupchat message from ${original_stanza.getAttribute('from')}`,
            );
        }
        delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, forwarded_stanza.parentElement).pop();
        body = forwarded_stanza.querySelector(':scope > body')?.textContent?.trim();
    } else {
        delay = sizzle(`message > delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
        body = original_stanza.querySelector(':scope > body')?.textContent?.trim();
    }


    const from = stanza.getAttribute('from');
    const marker = getChatMarker(stanza);

    let attrs = /** @type {MUCMessageAttributes} */(Object.assign(
        {
            from,
            body,
            'activities': getMEPActivities(stanza),
            'chat_state': getChatState(stanza),
            'from_muc': Strophe.getBareJidFromJid(from),
            'is_archived': isArchived(original_stanza),
            'is_carbon': isCarbon(original_stanza),
            'is_delayed': !!delay,
            'is_forwarded': !!sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).length,
            'is_headline': isHeadline(stanza),
            'is_markable': !!sizzle(`message > markable[xmlns="${Strophe.NS.MARKERS}"]`, stanza).length,
            'is_marker': !!marker,
            'is_unstyled': !!sizzle(`message > unstyled[xmlns="${Strophe.NS.STYLING}"]`, stanza).length,
            'marker_id': marker && marker.getAttribute('id'),
            'msgid': stanza.getAttribute('id') || original_stanza.getAttribute('id'),
            'nick': Strophe.unescapeNode(Strophe.getResourceFromJid(from)),
            'occupant_id': getOccupantID(stanza, chatbox),
            'receipt_id': getReceiptId(stanza),
            'received': new Date().toISOString(),
            'references': getReferences(stanza),
            'subject': stanza.querySelector(':scope > subject')?.textContent,
            'thread': stanza.querySelector(':scope > thread')?.textContent,
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
        getStatusCodes(stanza, 'message'),
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
            original_stanza,
            `Invalid Stanza: Forged MAM message from ${original_stanza.getAttribute('from')}`,
        );
    } else if (attrs.is_archived && original_stanza.getAttribute('from') !== chatbox.get('jid')) {
        return new StanzaParseError(
            original_stanza,
            `Invalid Stanza: Forged MAM groupchat message from ${stanza.getAttribute('from')}`,
        );
    } else if (attrs.is_carbon) {
        return new StanzaParseError(original_stanza, 'Invalid Stanza: MUC messages SHOULD NOT be XEP-0280 carbon copied');
    }

    // We prefer to use one of the XEP-0359 unique and stable stanza IDs as the Model id, to avoid duplicates.
    attrs['id'] = attrs['origin_id'] || attrs[`stanza_id ${attrs.from_muc || attrs.from}`] || u.getUniqueId();

    /**
     * *Hook* which allows plugins to add additional parsing
     * @event _converse#parseMUCMessage
     */
    attrs = await api.hook('parseMUCMessage', original_stanza, attrs);

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
 * @param {Element} stanza - The presence stanza
 * @param {string} nick
 * @returns {import('./types').MUCPresenceItemAttributes}
 */
function parsePresenceUserItem(stanza, nick) {
    /**
     * @typedef {import('./types').MUCAffiliation} MUCAffiliation
     * @typedef {import('./types').MUCRole} MUCRole
     */
    const item = sizzle(`presence > x[xmlns="${Strophe.NS.MUC_USER}"] item`, stanza).pop();
    if (item) {
        const actor = item.querySelector('actor');
        return {
            affiliation: /** @type {MUCAffiliation} */ (item.getAttribute('affiliation')),
            role: /** @type {MUCRole} */ (item.getAttribute('role')),
            jid: item.getAttribute('jid'),
            nick: item.getAttribute('nick') || nick,
            ...(actor
                ? {
                      actor: {
                          nick: actor?.getAttribute('nick') ?? null,
                          jid: actor?.getAttribute('jid') ?? null,
                      },
                  }
                : {}),
            reason: item.querySelector('reason')?.textContent ?? null,
        };
    }
}

/**
 * Parses a passed in MUC presence stanza and returns an object of attributes.
 * @param {Element} stanza - The presence stanza
 * @param {MUC} chatbox
 * @returns {import('./types').MUCPresenceAttributes}
 */
export function parseMUCPresence (stanza, chatbox) {
    /**
     * @typedef {import('./types').MUCPresenceAttributes} MUCPresenceAttributes
     */
    const from = stanza.getAttribute('from');
    const type = stanza.getAttribute('type');
    const nick = Strophe.getResourceFromJid(from);
    const attrs = /** @type {MUCPresenceAttributes} */({
        from,
        nick,
        occupant_id: getOccupantID(stanza, chatbox),
        type,
        status: stanza.querySelector(':scope > status')?.textContent ?? undefined,
        show: stanza.querySelector(':scope > show')?.textContent ?? (type !== 'unavailable' ? 'online' : 'offline'),
        image_hash: sizzle(`presence > x[xmlns="${Strophe.NS.VCARDUPDATE}"] photo`, stanza).pop()?.textContent,
        hats: sizzle(`presence > hats[xmlns="${Strophe.NS.MUC_HATS}"] hat`, stanza).map(/** @param {Element} h */(h) => ({
            title: h.getAttribute('title'),
            uri: h.getAttribute('uri')
        })),
        ...getStatusCodes(stanza, 'presence'),
        ...parsePresenceUserItem(stanza, nick),
    });
    return attrs;
}
