import * as strophe from 'strophe.js/src/core';
import { get, propertyOf } from "lodash";
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
     * @method _converse.stanza_utils#getStanzaIDs
     * @param { XMLElement } stanza - The message stanza
     * @returns { Object }
     */
    getStanzaIDs (stanza) {
        const attrs = {};
        const stanza_ids = sizzle(`stanza-id[xmlns="${Strophe.NS.SID}"]`, stanza);
        if (stanza_ids.length) {
            stanza_ids.forEach(s => (attrs[`stanza_id ${s.getAttribute('by')}`] = s.getAttribute('id')));
        }
        const result = sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, stanza).pop();
        if (result) {
            const by_jid = stanza.getAttribute('from');
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

    /**
     * Parses a passed in message stanza and returns an object of known attributes related to
     * XEP-0422 Message Fastening.
     * @private
     * @method _converse.stanza_utils#getMessageFasteningAttributes
     * @param { XMLElement } stanza - The message stanza
     * @returns { Object }
     */
    getMessageFasteningAttributes (stanza) {
        const substanza = sizzle(`apply-to[xmlns="${Strophe.NS.FASTEN}"]`, stanza).pop();
        if (substanza === null) {
            return {};
        }
        const moderated = sizzle(`moderated[xmlns="${Strophe.NS.MODERATE}"]`, substanza).pop();
        if (moderated) {
            const retracted = !!sizzle(`retract[xmlns="${Strophe.NS.RETRACT}"]`, moderated).length;
            return {
                'moderated': retracted ? 'retracted' : 'unknown',
                'moderated_by': moderated.get('by'),
                'moderated_reason': get(moderated.querySelector('reason'), 'textContent')
            }
        }
    },

    getReferences (stanza) {
        const text = propertyOf(stanza.querySelector('body'))('textContent');
        return sizzle(`reference[xmlns="${Strophe.NS.REFERENCE}"]`, stanza).map(ref => {
            const begin = ref.getAttribute('begin'),
                  end = ref.getAttribute('end');
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
        const type = stanza.getAttribute('type');
        if (type === 'groupchat') {
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

    getCorrectionAttributes (stanza) {
        const el = sizzle(`replace[xmlns="${Strophe.NS.MESSAGE_CORRECT}"]`, stanza).pop();
        if (el) {
            const replaced_id = el.getAttribute('id');
            const msgid = replaced_id;
            if (replaced_id) {
                return {
                    msgid,
                    replaced_id,
                    'edited': new Date().toISOString()
                }
            }
        }
        return {};
    }
}

export default stanza_utils;
