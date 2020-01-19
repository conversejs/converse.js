import * as strophe from 'strophe.js/src/core';
import { get, propertyOf } from "lodash";
import dayjs from 'dayjs';
import log from '@converse/headless/log';
import sizzle from 'sizzle';
import u from '@converse/headless/utils/core';

const Strophe = strophe.default.Strophe;

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
     * Extract the XEP-0359 stanza IDs from the passed in stanza
     * and return a map containing them.
     * @private
     * @method stanza_utils#getStanzaIDs
     * @param { XMLElement } stanza - The message stanza
     * @returns { Object }
     */
    getStanzaIDs (stanza, original_stanza) {
        const attrs = {};
        const stanza_ids = sizzle(`stanza-id[xmlns="${Strophe.NS.SID}"]`, stanza);
        if (stanza_ids.length) {
            stanza_ids.forEach(s => (attrs[`stanza_id ${s.getAttribute('by')}`] = s.getAttribute('id')));
        }
        const result = sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, original_stanza).pop();
        if (result) {
            const by_jid = original_stanza.getAttribute('from');
            attrs[`stanza_id ${by_jid}`] = result.getAttribute('id');
        }

        const origin_id = sizzle(`origin-id[xmlns="${Strophe.NS.SID}"]`, stanza).pop();
        if (origin_id) {
            attrs['origin_id'] = origin_id.getAttribute('id');
        }
        // We prefer to use one of the XEP-0359 unique and stable stanza IDs
        // as the Model id, to avoid duplicates.
        attrs['id'] = attrs['origin_id'] || attrs[`stanza_id ${attrs.from}`] || u.getUniqueId();
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
                        'edtiable': false,
                        'moderated': 'retracted',
                        'moderated_by': moderated.getAttribute('by'),
                        'moderated_id': applies_to_id,
                        'moderation_reason': get(moderated.querySelector('reason'), 'textContent')
                    }
                }
            }
        } else {
            const tombstone = sizzle(`> moderated[xmlns="${Strophe.NS.MODERATE}"]`, stanza).pop();
            if (tombstone) {
                const retracted = sizzle(`retracted[xmlns="${Strophe.NS.RETRACT}"]`, tombstone).pop();
                if (retracted) {
                    return {
                        'edtiable': false,
                        'is_tombstone': true,
                        'moderated_by': tombstone.getAttribute('by'),
                        'retracted': tombstone.getAttribute('stamp'),
                        'moderation_reason': get(tombstone.querySelector('reason'), 'textContent')

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


    getSenderAttributes (stanza, chatbox, _converse) {
        if (u.isChatRoom(chatbox)) {
            const from = stanza.getAttribute('from');
            const nick = Strophe.unescapeNode(Strophe.getResourceFromJid(from));
            return {
                'from':  from,
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
    },

    getSpoilerAttributes (stanza) {
        const spoiler = sizzle(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`, stanza).pop();
        return {
            'is_spoiler': !!spoiler,
            'spoiler_hint': get(spoiler, 'textContent')
        }
    },

    getOutOfBandAttributes (stanza) {
        const xform = sizzle(`x[xmlns="${Strophe.NS.OUTOFBAND}"]`, stanza).pop();
        if (xform) {
            return {
                'oob_url': get(xform.querySelector('url'), 'textContent'),
                'oob_desc': get(xform.querySelector('desc'), 'textContent')
            }
        }
        return {};
    },

    getCorrectionAttributes (stanza, original_stanza) {
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
     * @method stanza_utils#getMessageAttributesFromStanza
     * @param { XMLElement } stanza - The message stanza
     * @param { XMLElement } original_stanza - The original stanza, that contains the
     *  message stanza, if it was contained, otherwise it's the message stanza itself.
     * @param { _converse.ChatBox|_converse.ChatRoom } chatbox
     * @param { _converse } _converse
     * @returns { Object }
     */
    getMessageAttributesFromStanza (stanza, original_stanza, chatbox, _converse) {
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
            stanza_utils.getSenderAttributes(stanza, chatbox, _converse),
            stanza_utils.getOutOfBandAttributes(stanza),
            stanza_utils.getSpoilerAttributes(stanza),
            stanza_utils.getCorrectionAttributes(stanza, original_stanza)
        )
        return attrs;
    }
}

export default stanza_utils;
