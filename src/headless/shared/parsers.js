import URI from 'urijs';
import dayjs from 'dayjs';
import log from '@converse/headless/log';
import sizzle from 'sizzle';
import { Strophe } from 'strophe.js/src/strophe';
import { URL_PARSE_OPTIONS } from '@converse/headless/shared/constants.js';
import { _converse, api } from '@converse/headless/core';
import { decodeHTMLEntities } from '@converse/headless/utils/core.js';
import { rejectMessage } from '@converse/headless/shared/actions';
import {
    isAudioURL,
    isEncryptedFileURL,
    isImageURL,
    isVideoURL
} from '@converse/headless/utils/url.js';

const { NS } = Strophe;

export class StanzaParseError extends Error {
    constructor (message, stanza) {
        super(message, stanza);
        this.name = 'StanzaParseError';
        this.stanza = stanza;
    }
}

/**
 * Extract the XEP-0359 stanza IDs from the passed in stanza
 * and return a map containing them.
 * @private
 * @param { XMLElement } stanza - The message stanza
 * @returns { Object }
 */
export function getStanzaIDs (stanza, original_stanza) {
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

export function getEncryptionAttributes (stanza) {
    const eme_tag = sizzle(`encryption[xmlns="${Strophe.NS.EME}"]`, stanza).pop();
    const namespace = eme_tag?.getAttribute('namespace');
    const attrs = {};
    if (namespace) {
        attrs.is_encrypted = true;
        attrs.encryption_namespace = namespace;
    } else if (sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, stanza).pop()) {
        attrs.is_encrypted = true;
        attrs.encryption_namespace = Strophe.NS.OMEMO;
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
export function getRetractionAttributes (stanza, original_stanza) {
    const fastening = sizzle(`> apply-to[xmlns="${Strophe.NS.FASTEN}"]`, stanza).pop();
    if (fastening) {
        const applies_to_id = fastening.getAttribute('id');
        const retracted = sizzle(`> retract[xmlns="${Strophe.NS.RETRACT}"]`, fastening).pop();
        if (retracted) {
            const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
            const time = delay ? dayjs(delay.getAttribute('stamp')).toISOString() : new Date().toISOString();
            return {
                'editable': false,
                'retracted': time,
                'retracted_id': applies_to_id
            };
        }
    } else {
        const tombstone = sizzle(`> retracted[xmlns="${Strophe.NS.RETRACT}"]`, stanza).pop();
        if (tombstone) {
            return {
                'editable': false,
                'is_tombstone': true,
                'retracted': tombstone.getAttribute('stamp')
            };
        }
    }
    return {};
}

export function getCorrectionAttributes (stanza, original_stanza) {
    const el = sizzle(`replace[xmlns="${Strophe.NS.MESSAGE_CORRECT}"]`, stanza).pop();
    if (el) {
        const replace_id = el.getAttribute('id');
        if (replace_id) {
            const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, original_stanza).pop();
            const time = delay ? dayjs(delay.getAttribute('stamp')).toISOString() : new Date().toISOString();
            return {
                replace_id,
                'edited': time
            };
        }
    }
    return {};
}

export function getOpenGraphMetadata (stanza) {
    const fastening = sizzle(`> apply-to[xmlns="${Strophe.NS.FASTEN}"]`, stanza).pop();
    if (fastening) {
        const applies_to_id = fastening.getAttribute('id');
        const meta = sizzle(`> meta[xmlns="${Strophe.NS.XHTML}"]`, fastening);
        if (meta.length) {
            const msg_limit = api.settings.get('message_limit');
            const data = meta.reduce((acc, el) => {
                const property = el.getAttribute('property');
                if (property) {
                    let value = decodeHTMLEntities(el.getAttribute('content') || '');
                    if (msg_limit && property === 'og:description' && value.length >= msg_limit) {
                        value = `${value.slice(0, msg_limit)}${decodeHTMLEntities('&#8230;')}`;
                    }
                    acc[property] = value;
                }
                return acc;
            }, {
                'ogp_for_id': applies_to_id,
            });

            if ("og:description" in data || "og:title" in data || "og:image" in data) {
                return data;
            }
        }
    }
    return {};
}


export function getMediaURLsMetadata (text, offset=0) {
    const objs = [];
    if (!text) {
        return {};
    }
    try {
        URI.withinString(
            text,
            (url, start, end) => {
                if (url.startsWith('_')) {
                    url = url.slice(1);
                    start += 1;
                }
                if (url.endsWith('_')) {
                    url = url.slice(0, url.length-1);
                    end -= 1;
                }
                objs.push({ url, 'start': start+offset, 'end': end+offset });
                return url;
            },
            URL_PARSE_OPTIONS
        );
    } catch (error) {
        log.debug(error);
    }

    /**
     * @typedef { Object } MediaURLMetadata
     * An object representing the metadata of a URL found in a chat message
     * The actual URL is not saved, it can be extracted via the `start` and `end` indexes.
     * @property { Boolean } is_audio
     * @property { Boolean } is_image
     * @property { Boolean } is_video
     * @property { String } end
     * @property { String } start
     */
    const media_urls = objs
        .map(o => ({
            'end': o.end,
            'is_audio': isAudioURL(o.url),
            'is_image': isImageURL(o.url),
            'is_video': isVideoURL(o.url),
            'is_encrypted': isEncryptedFileURL(o.url),
            'start': o.start

        }));
    return media_urls.length ? { media_urls } : {};
}


export function getSpoilerAttributes (stanza) {
    const spoiler = sizzle(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`, stanza).pop();
    return {
        'is_spoiler': !!spoiler,
        'spoiler_hint': spoiler?.textContent
    };
}

export function getOutOfBandAttributes (stanza) {
    const xform = sizzle(`x[xmlns="${Strophe.NS.OUTOFBAND}"]`, stanza).pop();
    if (xform) {
        return {
            'oob_url': xform.querySelector('url')?.textContent,
            'oob_desc': xform.querySelector('desc')?.textContent
        };
    }
    return {};
}

/**
 * Returns the human readable error message contained in a `groupchat` message stanza of type `error`.
 * @private
 * @param { XMLElement } stanza - The message stanza
 */
export function getErrorAttributes (stanza) {
    if (stanza.getAttribute('type') === 'error') {
        const error = stanza.querySelector('error');
        const text = sizzle(`text[xmlns="${Strophe.NS.STANZAS}"]`, error).pop();
        return {
            'is_error': true,
            'error_text': text?.textContent,
            'error_type': error.getAttribute('type'),
            'error_condition': error.firstElementChild.nodeName
        };
    }
    return {};
}

/**
 * Given a message stanza, find and return any XEP-0372 references
 * @param { XMLElement } stana - The message stanza
 * @returns { Reference }
 */
export function getReferences (stanza) {
    return sizzle(`reference[xmlns="${Strophe.NS.REFERENCE}"]`, stanza).map(ref => {
        const anchor = ref.getAttribute('anchor');
        const text = stanza.querySelector(anchor ? `#${anchor}` : 'body')?.textContent;
        if (!text) {
            log.warn(`Could not find referenced text for ${ref}`);
            return null;
        }
        const begin = ref.getAttribute('begin');
        const end = ref.getAttribute('end');
        /**
         * @typedef { Object } Reference
         * An object representing XEP-0372 reference data
         * @property { string } begin
         * @property { string } end
         * @property { string } type
         * @property { String } value
         * @property { String } uri
         */
        return {
            begin, end,
            'type': ref.getAttribute('type'),
            'value': text.slice(begin, end),
            'uri': ref.getAttribute('uri')
        };
    }).filter(r => r);
}

export function getReceiptId (stanza) {
    const receipt = sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).pop();
    return receipt?.getAttribute('id');
}

/**
 * Determines whether the passed in stanza is a XEP-0280 Carbon
 * @private
 * @param { XMLElement } stanza - The message stanza
 * @returns { Boolean }
 */
export function isCarbon (stanza) {
    const xmlns = Strophe.NS.CARBONS;
    return (
        sizzle(`message > received[xmlns="${xmlns}"]`, stanza).length > 0 ||
        sizzle(`message > sent[xmlns="${xmlns}"]`, stanza).length > 0
    );
}

/**
 * Returns the XEP-0085 chat state contained in a message stanza
 * @private
 * @param { XMLElement } stanza - The message stanza
 */
export function getChatState (stanza) {
    return sizzle(
        `
        composing[xmlns="${NS.CHATSTATES}"],
        paused[xmlns="${NS.CHATSTATES}"],
        inactive[xmlns="${NS.CHATSTATES}"],
        active[xmlns="${NS.CHATSTATES}"],
        gone[xmlns="${NS.CHATSTATES}"]`,
        stanza
    ).pop()?.nodeName;
}

export function isValidReceiptRequest (stanza, attrs) {
    return (
        attrs.sender !== 'me' &&
        !attrs.is_carbon &&
        !attrs.is_archived &&
        sizzle(`request[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).length
    );
}

/**
 * Check whether the passed-in stanza is a forwarded message that is "bare",
 * i.e. it's not forwarded as part of a larger protocol, like MAM.
 * @param { XMLElement } stanza
 */
export function throwErrorIfInvalidForward (stanza) {
    const bare_forward = sizzle(`message > forwarded[xmlns="${Strophe.NS.FORWARD}"]`, stanza).length;
    if (bare_forward) {
        rejectMessage(stanza, 'Forwarded messages not part of an encapsulating protocol are not supported');
        const from_jid = stanza.getAttribute('from');
        throw new StanzaParseError(`Ignoring unencapsulated forwarded message from ${from_jid}`, stanza);
    }
}

/**
 * Determines whether the passed in stanza is a XEP-0333 Chat Marker
 * @private
 * @method getChatMarker
 * @param { XMLElement } stanza - The message stanza
 * @returns { Boolean }
 */
export function getChatMarker (stanza) {
    // If we receive more than one marker (which shouldn't happen), we take
    // the highest level of acknowledgement.
    return sizzle(`
        acknowledged[xmlns="${Strophe.NS.MARKERS}"],
        displayed[xmlns="${Strophe.NS.MARKERS}"],
        received[xmlns="${Strophe.NS.MARKERS}"]`,
        stanza
    ).pop();
}

export function isHeadline (stanza) {
    return stanza.getAttribute('type') === 'headline';
}

export function isServerMessage (stanza) {
    if (sizzle(`mentions[xmlns="${Strophe.NS.MENTIONS}"]`, stanza).pop()) {
        return false;
    }
    const from_jid = stanza.getAttribute('from');
    if (stanza.getAttribute('type') !== 'error' && from_jid && !from_jid.includes('@')) {
        // Some servers (e.g. Prosody) don't set the stanza
        // type to "headline" when sending server messages.
        // For now we check if an @ signal is included, and if not,
        // we assume it's a headline stanza.
        return true;
    }
    return false;
}

/**
 * Determines whether the passed in stanza is a XEP-0313 MAM stanza
 * @private
 * @method isArchived
 * @param { XMLElement } stanza - The message stanza
 * @returns { Boolean }
 */
export function isArchived (original_stanza) {
    return !!sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, original_stanza).pop();
}


/**
 * Returns an object containing all attribute names and values for a particular element.
 * @method getAttributes
 * @param { XMLElement } stanza
 * @returns { Object }
 */
export function getAttributes (stanza) {
    return stanza.getAttributeNames().reduce((acc, name) => {
        acc[name] = Strophe.xmlunescape(stanza.getAttribute(name));
        return acc;
    }, {});
}
