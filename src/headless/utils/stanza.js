import * as strophe from 'strophe.js/src/core';
import { propertyOf } from "lodash";
import dayjs from 'dayjs';
import log from '@converse/headless/log';
import sizzle from 'sizzle';
import u from '@converse/headless/utils/core';

const Strophe = strophe.default.Strophe;


function getSenderAttributes (stanza, chatbox, _converse) {
    if (u.isChatRoom(chatbox)) {
        const from = stanza.getAttribute('from');
        const nick = Strophe.unescapeNode(Strophe.getResourceFromJid(from));
        return {
            'from':  from,
            'from_muc': Strophe.getBareJidFromJid(from),
            'nick': nick,
            'sender': nick === chatbox.get('nick') ? 'me': 'them',
            'received': (new Date()).toISOString(),
        }
    } else {
        const from = Strophe.getBareJidFromJid(stanza.getAttribute('from'));
        if (from === _converse.bare_jid) {
            return {
                from,
                'sender': 'me',
                'fullname': _converse.xmppstatus.get('fullname')
            }
        } else {
            return {
                from,
                'sender': 'them',
                'fullname': chatbox.get('fullname')
            }
        }
    }
}

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
        const replaced_id = el.getAttribute('id');
        const msgid = replaced_id;
        if (replaced_id) {
            const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
            const time = delay ? dayjs(delay.getAttribute('stamp')).toISOString() : (new Date()).toISOString();
            return {
                msgid,
                replaced_id,
                'edited': time
            }
        }
    }
    return {};
}

function getEncryptionAttributes (stanza, original_stanza, attrs, chatbox, _converse) {
    const encrypted = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, original_stanza).pop();
    if (!encrypted || !_converse.config.get('trusted')) {
        return attrs;
    }
    const device_id = _converse.omemo_store?.get('device_id');
    const key = device_id && sizzle(`key[rid="${device_id}"]`, encrypted).pop();
    if (key) {
        const header = encrypted.querySelector('header');
        attrs['is_encrypted'] = true;
        attrs['encrypted'] = {
            'device_id': header.getAttribute('sid'),
            'iv': header.querySelector('iv').textContent,
            'key': key.textContent,
            'payload': encrypted.querySelector('payload')?.textContent || null,
            'prekey': ['true', '1'].includes(key.getAttribute('prekey'))
        }
        // Returns a promise
        return chatbox.decrypt(attrs);
    } else {
        return attrs;
    }
}


/**
 * The stanza utils object. Contains utility functions related to stanza
 * processing.
 * @namespace stanza_utils
 */
const stanza_utils = {

    isReceipt (stanza) {
        return sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).length > 0;
    },

    isChatMarker (stanza) {
        return sizzle(
            `received[xmlns="${Strophe.NS.MARKERS}"],
             displayed[xmlns="${Strophe.NS.MARKERS}"],
             acknowledged[xmlns="${Strophe.NS.MARKERS}"]`, stanza).length > 0;
    },

    /**
     * Determines whether the passed in stanza represents a XEP-0313 MAM stanza
     * @private
     * @method stanza_utils#isArchived
     * @param { XMLElement } stanza - The message stanza
     * @returns { Boolean }
     */
    isArchived (original_stanza) {
        return !!sizzle(`result[xmlns="${Strophe.NS.MAM}"]`, original_stanza).pop();
    },

    /**
     * Returns an object containing all attribute names and values for a particular element.
     * @private
     * @method stanza_utils#getAttributes
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
     * Extract the XEP-0359 stanza IDs from the passed in stanza
     * and return a map containing them.
     * @private
     * @method stanza_utils#getStanzaIDs
     * @param { XMLElement } stanza - The message stanza
     * @returns { Object }
     */
    getStanzaIDs (stanza, original_stanza) {
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
            const by_jid = original_stanza.getAttribute('from');
            attrs[`stanza_id ${by_jid}`] = result.getAttribute('id');
        }

        // Store the origin id
        const origin_id = sizzle(`origin-id[xmlns="${Strophe.NS.SID}"]`, stanza).pop();
        if (origin_id) {
            attrs['origin_id'] = origin_id.getAttribute('id');
        }
        return attrs;
    },

    /** @method stanza_utils#getModerationAttributes
     * @param { XMLElement } stanza - The message stanza
     * @param { XMLElement } original_stanza - The original stanza, that contains the
     *  message stanza, if it was contained, otherwise it's the message stanza itself.
     * @param { _converse.ChatRoom } room - The MUC in which the moderation stanza is received.
     * @returns { Object }
     */
    getModerationAttributes (stanza, original_stanza, room) {
        const fastening = sizzle(`apply-to[xmlns="${Strophe.NS.FASTEN}"]`, stanza).pop();
        if (fastening) {
            const applies_to_id = fastening.getAttribute('id');
            const moderated = sizzle(`moderated[xmlns="${Strophe.NS.MODERATE}"]`, fastening).pop();
            if (moderated) {
                const retracted = sizzle(`retract[xmlns="${Strophe.NS.RETRACT}"]`, moderated).pop();
                if (retracted) {
                    const from = stanza.getAttribute('from');
                    if (from !== room.get('jid')) {
                        log.warn("getModerationAttributes: ignore moderation stanza that's not from the MUC!");
                        log.error(original_stanza);
                        return {};
                    }
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
    },


    /**
     * @method stanza_utils#getRetractionAttributes
     * @param { XMLElement } stanza - The message stanza
     * @param { XMLElement } original_stanza - The original stanza, that contains the
     *  message stanza, if it was contained, otherwise it's the message stanza itself.
     * @returns { Object }
     */
    getRetractionAttributes (stanza, original_stanza) {
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
    },

    getReferences (stanza) {
        const text = propertyOf(stanza.querySelector('body'))('textContent');
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
    },

    getErrorMessage (stanza, is_muc, _converse) {
        const { __ } = _converse;
        if (is_muc) {
            const forbidden = sizzle(`error forbidden[xmlns="${Strophe.NS.STANZAS}"]`, stanza).pop();
            if (forbidden) {
                const msg = __("Your message was not delivered because you weren't allowed to send it.");
                const text = sizzle(`error text[xmlns="${Strophe.NS.STANZAS}"]`, stanza).pop();
                const server_msg = text ? __('The message from the server is: "%1$s"', text.textContent) : '';
                return server_msg ? `${msg} ${server_msg}` : msg;
            } else if (sizzle(`not-acceptable[xmlns="${Strophe.NS.STANZAS}"]`, stanza).length) {
                return __("Your message was not delivered because you're not present in the groupchat.");
            }
        }
        const error = stanza.querySelector('error');
        return propertyOf(error.querySelector('text'))('textContent') ||
            __('Sorry, an error occurred:') + ' ' + error.innerHTML;
    },

    /**
     * Given a message stanza, return the text contained in its body.
     * @private
     * @method stanza_utils#getMessageBody
     * @param { XMLElement } stanza
     * @param { Boolean } is_muc
     * @param { _converse } _converse
     */
    getMessageBody (stanza, is_muc, _converse) {
        const type = stanza.getAttribute('type');
        if (type === 'error') {
            return stanza_utils.getErrorMessage(stanza, is_muc, _converse);
        } else {
            const body = stanza.querySelector('body');
            if (body) {
                return body.textContent.trim();
            }
        }
    },

    getChatState (stanza) {
        return stanza.getElementsByTagName('composing').length && 'composing' ||
            stanza.getElementsByTagName('paused').length && 'paused' ||
            stanza.getElementsByTagName('inactive').length && 'inactive' ||
            stanza.getElementsByTagName('active').length && 'active' ||
            stanza.getElementsByTagName('gone').length && 'gone';
    },

    /**
     * Parses a passed in message stanza and returns an object of attributes.
     * @private
     * @method stanza_utils#parseMessage
     * @param { XMLElement } stanza - The message stanza
     * @param { XMLElement } original_stanza - The original stanza, that contains the
     *  message stanza, if it was contained, otherwise it's the message stanza itself.
     * @param { _converse.ChatBox|_converse.ChatRoom } chatbox
     * @param { _converse } _converse
     * @returns { Object }
     */
    async parseMessage (stanza, original_stanza, chatbox, _converse) {
        const is_muc = u.isChatRoom(chatbox);
        let attrs = Object.assign(
            stanza_utils.getStanzaIDs(stanza, original_stanza),
            stanza_utils.getRetractionAttributes(stanza, original_stanza),
            is_muc ? stanza_utils.getModerationAttributes(stanza, original_stanza, chatbox) : {},
        );
        const text = stanza_utils.getMessageBody(stanza, is_muc, _converse) || undefined;
        const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
        attrs = Object.assign(
            {
                'chat_state': stanza_utils.getChatState(stanza),
                'is_archived': stanza_utils.isArchived(original_stanza),
                'is_delayed': !!delay,
                'is_only_emojis': text ? u.isOnlyEmojis(text) : false,
                'message': text,
                'msgid': stanza.getAttribute('id') || original_stanza.getAttribute('id'),
                'references': stanza_utils.getReferences(stanza),
                'subject': propertyOf(stanza.querySelector('subject'))('textContent'),
                'thread': propertyOf(stanza.querySelector('thread'))('textContent'),
                'time': delay ? dayjs(delay.getAttribute('stamp')).toISOString() : (new Date()).toISOString(),
                'type': stanza.getAttribute('type')
            },
            attrs,
            getSenderAttributes(stanza, chatbox, _converse),
            getOutOfBandAttributes(stanza),
            getSpoilerAttributes(stanza),
            getCorrectionAttributes(stanza, original_stanza),
        )
       attrs = await getEncryptionAttributes(stanza, original_stanza, attrs, chatbox, _converse)
        // We prefer to use one of the XEP-0359 unique and stable stanza IDs
        // as the Model id, to avoid duplicates.
        attrs['id'] = attrs['origin_id'] || attrs[`stanza_id ${(attrs.from_muc || attrs.from)}`] || u.getUniqueId();
        return attrs;
    },

    /**
     * Parses a passed in MUC presence stanza and returns an object of attributes.
     * @private
     * @method stanza_utils#parseMUCPresence
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
                    'id': c.getAttribute('id')
                });
            }
        });
        return data;
    }
}

export default stanza_utils;
