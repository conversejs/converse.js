import * as strophe from 'strophe.js/src/core';
import dayjs from 'dayjs';
import sizzle from 'sizzle';
import u from '@converse/headless/utils/core';
import log from "../log";
import { _converse, api } from "@converse/headless/converse-core";

const Strophe = strophe.default.Strophe;
const $msg = strophe.default.$msg;
const { NS } = Strophe;


function getSpoilerAttributes (stanza) {
    const spoiler = sizzle(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`, stanza).pop();
    return {
        'is_spoiler': !!spoiler,
        'spoiler_hint': spoiler?.textContent
    }
}

function getOutOfBandAttributes (stanza) {
    const xform = sizzle(`x[xmlns="${Strophe.NS.OUTOFBAND}"]`, stanza).pop();
    if (xform) {
        return {
            'oob_url': xform.querySelector('url')?.textContent,
            'oob_desc': xform.querySelector('desc')?.textContent
        }
    }
    return {};
}

function getCorrectionAttributes (stanza, original_stanza) {
    const el = sizzle(`replace[xmlns="${Strophe.NS.MESSAGE_CORRECT}"]`, stanza).pop();
    if (el) {
        const replace_id = el.getAttribute('id');
        const msgid = replace_id;
        if (replace_id) {
            const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
            const time = delay ? dayjs(delay.getAttribute('stamp')).toISOString() : (new Date()).toISOString();
            return {
                msgid,
                replace_id,
                'edited': time
            }
        }
    }
    return {};
}


function getEncryptionAttributes (stanza, _converse) {
    const encrypted = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).pop();
    const attrs = { 'is_encrypted': !!encrypted };
    if (!encrypted || api.settings.get('clear_cache_on_logout')) {
        return attrs;
    }
    const header = encrypted.querySelector('header');
    attrs['encrypted'] = {'device_id': header.getAttribute('sid')};

    const device_id = _converse.omemo_store?.get('device_id');
    const key = device_id && sizzle(`key[rid="${device_id}"]`, encrypted).pop();
    if (key) {
        Object.assign(attrs.encrypted, {
            'iv': header.querySelector('iv').textContent,
            'key': key.textContent,
            'payload': encrypted.querySelector('payload')?.textContent || null,
            'prekey': ['true', '1'].includes(key.getAttribute('prekey'))
        });
    }
    return attrs;
}


function isValidReceiptRequest (stanza, attrs) {
    return (
        attrs.sender !== 'me' &&
        !attrs.is_carbon &&
        !attrs.is_archived &&
        sizzle(`request[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).length
    );
}


function getReceiptId (stanza) {
    const receipt = sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).pop();
    return receipt?.getAttribute('id');
}

/**
 * Returns the XEP-0085 chat state contained in a message stanza
 * @private
 * @param { XMLElement } stanza - The message stanza
 */
function getChatState (stanza) {
    return sizzle(`
        composing[xmlns="${NS.CHATSTATES}"],
        paused[xmlns="${NS.CHATSTATES}"],
        inactive[xmlns="${NS.CHATSTATES}"],
        active[xmlns="${NS.CHATSTATES}"],
        gone[xmlns="${NS.CHATSTATES}"]`, stanza).pop()?.nodeName;
}

/**
 * Determines whether the passed in stanza is a XEP-0280 Carbon
 * @private
 * @param { XMLElement } stanza - The message stanza
 * @returns { Boolean }
 */
function isCarbon (stanza) {
    const xmlns = Strophe.NS.CARBONS;
    return sizzle(`message > received[xmlns="${xmlns}"]`, stanza).length > 0 ||
            sizzle(`message > sent[xmlns="${xmlns}"]`, stanza).length > 0;
}

/**
 * Extract the XEP-0359 stanza IDs from the passed in stanza
 * and return a map containing them.
 * @private
 * @param { XMLElement } stanza - The message stanza
 * @returns { Object }
 */
function getStanzaIDs (stanza, original_stanza) {
    const attrs = {};
    // Store generic stanza ids
    const sids = sizzle(`stanza-id[xmlns="${Strophe.NS.SID}"]`, stanza);
    const sid_attrs = sids.reduce((acc, s) => {
        acc[`stanza_id ${s.getAttribute('by')}`] = s.getAttribute('id');
        return acc;
    }, {});
    Object.assign(attrs, sid_attrs);

    // Store the archive id
    const result = sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, original_stanza).pop();
    if (result) {
        const by_jid = original_stanza.getAttribute('from') || _converse.bare_jid;
        attrs[`stanza_id ${by_jid}`] = result.getAttribute('id');
    }

    // Store the origin id
    const origin_id = sizzle(`origin-id[xmlns="${Strophe.NS.SID}"]`, stanza).pop();
    if (origin_id) {
        attrs['origin_id'] = origin_id.getAttribute('id');
    }
    return attrs;
}

/**
 * @private
 * @param { XMLElement } stanza - The message stanza
 * @param { XMLElement } original_stanza - The original stanza, that contains the
 *  message stanza, if it was contained, otherwise it's the message stanza itself.
 * @returns { Object }
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
                }
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

                }
            }
        }
    }
    return {};
}


/**
 * @private
 * @param { XMLElement } stanza - The message stanza
 * @param { XMLElement } original_stanza - The original stanza, that contains the
 *  message stanza, if it was contained, otherwise it's the message stanza itself.
 * @returns { Object }
 */
function getRetractionAttributes (stanza, original_stanza) {
    const fastening = sizzle(`> apply-to[xmlns="${Strophe.NS.FASTEN}"]`, stanza).pop();
    if (fastening) {
        const applies_to_id = fastening.getAttribute('id');
        const retracted = sizzle(`> retract[xmlns="${Strophe.NS.RETRACT}"]`, fastening).pop();
        if (retracted) {
            const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
            const time = delay ? dayjs(delay.getAttribute('stamp')).toISOString() : (new Date()).toISOString();
            return {
                'editable': false,
                'retracted': time,
                'retracted_id': applies_to_id
            }
        }
    } else {
        const tombstone = sizzle(`> retracted[xmlns="${Strophe.NS.RETRACT}"]`, stanza).pop();
        if (tombstone) {
            return {
                'editable': false,
                'is_tombstone': true,
                'retracted': tombstone.getAttribute('stamp')
            }
        }
    }
    return {};
}

function getReferences (stanza) {
    const text = stanza.querySelector('body')?.textContent;
    return sizzle(`reference[xmlns="${Strophe.NS.REFERENCE}"]`, stanza).map(ref => {
        const begin = ref.getAttribute('begin');
        const end = ref.getAttribute('end');
        return  {
            'begin': begin,
            'end': end,
            'type': ref.getAttribute('type'),
            'value': text.slice(begin, end),
            'uri': ref.getAttribute('uri')
        };
    });
}

function rejectMessage (stanza, text) {
    // Reject an incoming message by replying with an error message of type "cancel".
    api.send(
        $msg({
            'to': stanza.getAttribute('from'),
            'type': 'error',
            'id': stanza.getAttribute('id')
        }).c('error', {'type': 'cancel'})
            .c('not-allowed', {xmlns:"urn:ietf:params:xml:ns:xmpp-stanzas"}).up()
            .c('text', {xmlns:"urn:ietf:params:xml:ns:xmpp-stanzas"}).t(text)
    );
    log.warn(`Rejecting message stanza with the following reason: ${text}`);
    log.warn(stanza);
}


/**
 * Returns the human readable error message contained in a `groupchat` message stanza of type `error`.
 * @private
 * @param { XMLElement } stanza - The message stanza
 */
function getErrorAttributes (stanza) {
    if (stanza.getAttribute('type') === 'error') {
        const error = stanza.querySelector('error');
        const text = sizzle(`text[xmlns="${Strophe.NS.STANZAS}"]`, error).pop();
        return {
            'is_error': true,
            'error_text': text?.textContent,
            'error_type': error.getAttribute('type'),
            'error_condition': error.firstElementChild.nodeName
        }
    }
    return {};
}


class StanzaParseError extends Error {
    constructor (message, stanza) {
        super(message, stanza);
        this.name = 'StanzaParseError';
        this.stanza = stanza;
    }
}


function rejectUnencapsulatedForward (stanza) {
    const bare_forward = sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).length;
    if (bare_forward) {
        rejectMessage(
            stanza,
            'Forwarded messages not part of an encapsulating protocol are not supported'
        );
        const from_jid = stanza.getAttribute('from');
        return new StanzaParseError(`Ignoring unencapsulated forwarded message from ${from_jid}`, stanza);
    }
}


/**
 * The stanza utils object. Contains utility functions related to stanza processing.
 * @namespace st
 */
const st = {

    isHeadline (stanza) {
        return stanza.getAttribute('type') === 'headline';
    },

    isServerMessage (stanza) {
        const from_jid = stanza.getAttribute('from');
        if (stanza.getAttribute('type') !== 'error' && from_jid && !from_jid.includes('@')) {
            // Some servers (e.g. Prosody) don't set the stanza
            // type to "headline" when sending server messages.
            // For now we check if an @ signal is included, and if not,
            // we assume it's a headline stanza.
            return true;
        }
        return false;
    },

    /**
     * Determines whether the passed in stanza is a XEP-0333 Chat Marker
     * @private
     * @method st#getChatMarker
     * @param { XMLElement } stanza - The message stanza
     * @returns { Boolean }
     */
    getChatMarker (stanza) {
        // If we receive more than one marker (which shouldn't happen), we take
        // the highest level of acknowledgement.
        return sizzle(`
            acknowledged[xmlns="${Strophe.NS.MARKERS}"],
            displayed[xmlns="${Strophe.NS.MARKERS}"],
            received[xmlns="${Strophe.NS.MARKERS}"]`, stanza).pop();
    },

    /**
     * Determines whether the passed in stanza is a XEP-0313 MAM stanza
     * @private
     * @method st#isArchived
     * @param { XMLElement } stanza - The message stanza
     * @returns { Boolean }
     */
    isArchived (original_stanza) {
        return !!sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, original_stanza).pop();
    },

    /**
     * Returns an object containing all attribute names and values for a particular element.
     * @method st#getAttributes
     * @param { XMLElement } stanza
     * @returns { Object }
     */
    getAttributes (stanza) {
        return stanza.getAttributeNames().reduce((acc, name) => {
            acc[name] = Strophe.xmlunescape(stanza.getAttribute(name))
            return acc;
        }, {});
    },

    /**
     * Parses a passed in message stanza and returns an object of attributes.
     * @method st#parseMessage
     * @param { XMLElement } stanza - The message stanza
     * @param { _converse } _converse
     * @returns { (MessageAttributes|Error) }
     */
    async parseMessage (stanza, _converse) {
        const err = rejectUnencapsulatedForward(stanza);
        if (err) {
            return err;
        }

        let to_jid = stanza.getAttribute('to');
        const to_resource = Strophe.getResourceFromJid(to_jid);
        if (api.settings.get('filter_by_resource') && (to_resource && to_resource !== _converse.resource)) {
            return new StanzaParseError(`Ignoring incoming message intended for a different resource: ${to_jid}`, stanza);
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

        const is_archived = st.isArchived(stanza);
        if (is_archived) {
            if (from_jid === _converse.bare_jid) {
                const selector = `[xmlns="${Strophe.NS.MAM}"] > forwarded[xmlns="${Strophe.NS.FORWARD}"] > message`;
                stanza = sizzle(selector, stanza).pop();
                to_jid = stanza.getAttribute('to');
                from_jid = stanza.getAttribute('from');
            } else {
                return new StanzaParseError(`Invalid Stanza: alleged MAM message from ${stanza.getAttribute('from')}`, stanza);
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

        const is_headline = st.isHeadline(stanza);
        const is_server_message = st.isServerMessage(stanza);
        let contact, contact_jid;
        if (!is_headline && !is_server_message) {
            contact_jid = is_me ? Strophe.getBareJidFromJid(to_jid) : from_bare_jid;
            contact = await api.contacts.get(contact_jid);
            if (contact === undefined && !api.settings.get("allow_non_roster_messaging")) {
                log.error(stanza);
                return new StanzaParseError(
                    `Blocking messaging with a JID not in our roster because allow_non_roster_messaging is false.`,
                    stanza
                );
            }
        }
        /**
         * @typedef { Object } MessageAttributes
         * The object which {@link st.parseMessage} returns
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
         * @property { Boolean } is_valid_receipt_request - Does this message request a XEP-0184 receipt (and is not from us or a carbon or archived message)
         * @property { Boolean } is_spoiler - Is this a XEP-0382 spoiler message?
         * @property { Boolean } is_tombstone - Is this a XEP-0424 tombstone?
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
        const marker = st.getChatMarker(stanza);
        const now =  (new Date()).toISOString();
        let attrs = Object.assign({
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
                'marker_id': marker && marker.getAttribute('id'),
                'msgid': stanza.getAttribute('id') || original_stanza.getAttribute('id'),
                'nick': contact?.attributes?.nickname,
                'receipt_id': getReceiptId(stanza),
                'received': (new Date()).toISOString(),
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
        attrs = Object.assign({
            'message': attrs.body || attrs.error, // TODO: Remove and use body and error attributes instead
            'is_only_emojis': attrs.body ? u.isOnlyEmojis(attrs.body) : false,
            'is_valid_receipt_request': isValidReceiptRequest(stanza, attrs)
        }, attrs);

        // We prefer to use one of the XEP-0359 unique and stable stanza IDs
        // as the Model id, to avoid duplicates.
        attrs['id'] = attrs['origin_id'] || attrs[`stanza_id ${(attrs.from)}`] || u.getUniqueId();

        /**
         * *Hook* which allows plugins to add additional parsing
         * @event _converse#parseMessage
         */
        return api.hook('parseMessage', stanza, attrs);
    },

    /**
     * Parses a passed in message stanza and returns an object of attributes.
     * @method st#parseMUCMessage
     * @param { XMLElement } stanza - The message stanza
     * @param { XMLElement } original_stanza - The original stanza, that contains the
     *  message stanza, if it was contained, otherwise it's the message stanza itself.
     * @param { _converse.ChatRoom } chatbox
     * @param { _converse } _converse
     * @returns { Promise<MUCMessageAttributes|Error> }
     */
    async parseMUCMessage (stanza, chatbox, _converse) {
        const err = rejectUnencapsulatedForward(stanza);
        if (err) {
            return err;
        }

        const selector = `[xmlns="${NS.MAM}"] > forwarded[xmlns="${NS.FORWARD}"] > message`;
        const original_stanza = stanza;
        stanza = sizzle(selector, stanza).pop() || stanza;

        if (sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).length) {
            return new StanzaParseError(
                `Invalid Stanza: Forged MAM groupchat message from ${stanza.getAttribute('from')}`,
                stanza
            );
        }
        const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
        const from = stanza.getAttribute('from');
        const nick = Strophe.unescapeNode(Strophe.getResourceFromJid(from));
        const marker = st.getChatMarker(stanza);
        const now =  (new Date()).toISOString();
        /**
         * @typedef { Object } MUCMessageAttributes
         * The object which {@link st.parseMUCMessage} returns
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
         * @property { Boolean } is_valid_receipt_request - Does this message request a XEP-0184 receipt (and is not from us or a carbon or archived message)
         * @property { Boolean } is_spoiler - Is this a XEP-0382 spoiler message?
         * @property { Boolean } is_tombstone - Is this a XEP-0424 tombstone?
         * @property { Object } encrypted -  XEP-0384 encryption payload attributes
         * @property { String } body - The contents of the <body> tag of the message stanza
         * @property { String } chat_state - The XEP-0085 chat state notification contained in this message
         * @property { String } edited - An ISO8601 string recording the time that the message was edited per XEP-0308
         * @property { String } error_condition - The defined error condition
         * @property { String } error_text - The error text received from the server
         * @property { String } error_type - The type of error received from the server
         * @property { String } from - The sender JID (${muc_jid}/${nick})
         * @property { String } from_muc - The JID of the MUC from which this message was sent
         * @property { String } from_real_jid - The real JID of the sender, if available
         * @property { String } fullname - The full name of the sender
         * @property { String } marker - The XEP-0333 Chat Marker value
         * @property { String } marker_id - The `id` attribute of a XEP-0333 chat marker
         * @property { String } moderated - The type of XEP-0425 moderation (if any) that was applied
         * @property { String } moderated_by - The JID of the user that moderated this message
         * @property { String } moderated_id - The  XEP-0359 Stanza ID of the message that this one moderates
         * @property { String } moderation_reason - The reason provided why this message moderates another
         * @property { String } msgid - The root `id` attribute of the stanza
         * @property { String } nick - The MUC nickname of the sender
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
        let attrs = Object.assign({
                from,
                nick,
                'body': stanza.querySelector('body')?.textContent?.trim(),
                'chat_state': getChatState(stanza),
                'from_muc': Strophe.getBareJidFromJid(from),
                'from_real_jid': chatbox.occupants.findOccupant({nick})?.get('jid'),
                'is_archived': st.isArchived(original_stanza),
                'is_carbon': isCarbon(original_stanza),
                'is_delayed': !!delay,
                'is_headline': st.isHeadline(stanza),
                'is_markable': !!sizzle(`markable[xmlns="${Strophe.NS.MARKERS}"]`, stanza).length,
                'is_marker': !!marker,
                'marker_id': marker && marker.getAttribute('id'),
                'msgid': stanza.getAttribute('id') || original_stanza.getAttribute('id'),
                'receipt_id': getReceiptId(stanza),
                'received': (new Date()).toISOString(),
                'references': getReferences(stanza),
                'subject': stanza.querySelector('subject')?.textContent,
                'thread': stanza.querySelector('thread')?.textContent,
                'time': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : now,
                'to': stanza.getAttribute('to'),
                'type': stanza.getAttribute('type'),
            },
            getErrorAttributes(stanza),
            getOutOfBandAttributes(stanza),
            getSpoilerAttributes(stanza),
            getCorrectionAttributes(stanza, original_stanza),
            getStanzaIDs(stanza, original_stanza),
            getRetractionAttributes(stanza, original_stanza),
            getModerationAttributes(stanza),
            getEncryptionAttributes(stanza, _converse)
        );


        await api.emojis.initialize();
        attrs = Object.assign({
            'is_only_emojis': attrs.body ? u.isOnlyEmojis(attrs.body) : false,
            'is_valid_receipt_request': isValidReceiptRequest(stanza, attrs),
            'message': attrs.body || attrs.error, // TODO: Remove and use body and error attributes instead
            'sender': attrs.nick === chatbox.get('nick') ? 'me': 'them',
        }, attrs);

        if (attrs.is_archived && original_stanza.getAttribute('from') !== attrs.from_muc) {
            return new StanzaParseError(
                `Invalid Stanza: Forged MAM message from ${original_stanza.getAttribute('from')}`,
                stanza
            );
        } else if (attrs.is_archived && original_stanza.getAttribute('from') !== chatbox.get('jid')) {
            return new StanzaParseError(
                `Invalid Stanza: Forged MAM groupchat message from ${stanza.getAttribute('from')}`,
                stanza
            );
        } else if (attrs.is_carbon) {
            return new StanzaParseError(
                "Invalid Stanza: MUC messages SHOULD NOT be XEP-0280 carbon copied",
                stanza
            );
        }
        // We prefer to use one of the XEP-0359 unique and stable stanza IDs as the Model id, to avoid duplicates.
        attrs['id'] = attrs['origin_id'] || attrs[`stanza_id ${(attrs.from_muc || attrs.from)}`] || u.getUniqueId();
        /**
         * *Hook* which allows plugins to add additional parsing
         * @event _converse#parseMUCMessage
         */
        return api.hook('parseMUCMessage', stanza, attrs);
    },

    /**
     * Parses a passed in MUC presence stanza and returns an object of attributes.
     * @method st#parseMUCPresence
     * @param { XMLElement } stanza - The presence stanza
     * @returns { Object }
     */
    parseMUCPresence (stanza) {
        const from = stanza.getAttribute("from");
        const type = stanza.getAttribute("type");
        const data = {
            'from': from,
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
                    if (item.nodeName === "item") {
                        data.affiliation = item.getAttribute("affiliation");
                        data.role = item.getAttribute("role");
                        data.jid = item.getAttribute("jid");
                        data.nick = item.getAttribute("nick") || data.nick;
                    } else if (item.nodeName == 'status' && item.getAttribute("code")) {
                        data.states.push(item.getAttribute("code"));
                    }
                });
            } else if (child.matches('x') && child.getAttribute('xmlns') === Strophe.NS.VCARDUPDATE) {
                data.image_hash = child.querySelector('photo')?.textContent;
            } else if (child.matches('hats') && child.getAttribute('xmlns') === Strophe.NS.MUC_HATS) {
                data['hats'] = Array.from(child.children).map(c => c.matches('hat') && {
                    'title': c.getAttribute('title'),
                    'uri': c.getAttribute('uri')
                });
            }
        });
        return data;
    }
}

export default st;
