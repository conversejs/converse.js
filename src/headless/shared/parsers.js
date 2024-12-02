/**
 * @module:headless-shared-parsers
 */
import sizzle from 'sizzle';
import _converse from './_converse.js';
import api from './api/index.js';
import dayjs from 'dayjs';
import log from '../log.js';
import { Strophe } from 'strophe.js';
import { decodeHTMLEntities } from '../utils/html.js';
import { getAttributes } from '../utils/stanza.js';
import { rejectMessage } from './actions.js';
import { XFORM_TYPE_MAP,  XFORM_VALIDATE_TYPE_MAP } from './constants.js';


const { NS } = Strophe;

export class StanzaParseError extends Error {
    /**
     * @param {string} message
     * @param {Element} stanza
     */
    constructor (message, stanza) {
        super(message);
        this.name = 'StanzaParseError';
        this.stanza = stanza;
    }
}

/**
 * Extract the XEP-0359 stanza IDs from the passed in stanza
 * and return a map containing them.
 * @param {Element} stanza - The message stanza
 * @param {Element} original_stanza - The encapsulating stanza which contains
 *      the message stanza.
 * @returns {Object}
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
        const bare_jid = _converse.session.get('bare_jid');
        const by_jid = original_stanza.getAttribute('from') || bare_jid;
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
 * @param {Element} stanza
 */
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
 * @param {Element} stanza - The message stanza
 * @param {Element} original_stanza - The original stanza, that contains the
 *  message stanza, if it was contained, otherwise it's the message stanza itself.
 * @returns {Object}
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

/**
 * @param {Element} stanza
 * @param {Element} original_stanza
 */
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

/**
 * @param {Element} stanza
 */
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


/**
 * @param {Element} stanza
 */
export function getSpoilerAttributes (stanza) {
    const spoiler = sizzle(`spoiler[xmlns="${Strophe.NS.SPOILER}"]`, stanza).pop();
    return {
        'is_spoiler': !!spoiler,
        'spoiler_hint': spoiler?.textContent
    };
}

/**
 * @param {Element} stanza
 */
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
 * @param {Element} stanza - The message stanza
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
 * @typedef {Object} Reference
 * An object representing XEP-0372 reference data
 * @property {number} begin
 * @property {number} end
 * @property {string} type
 * @property {String} value
 * @property {String} uri
 */

/**
 * Given a message stanza, find and return any XEP-0372 references
 * @param {Element} stanza - The message stanza
 * @returns {Reference[]}
 */
export function getReferences (stanza) {
    return sizzle(`reference[xmlns="${Strophe.NS.REFERENCE}"]`, stanza).map(ref => {
        const anchor = ref.getAttribute('anchor');
        const text = stanza.querySelector(anchor ? `#${anchor}` : 'body')?.textContent;
        if (!text) {
            log.warn(`Could not find referenced text for ${ref}`);
            return null;
        }
        const begin = Number(ref.getAttribute('begin'));
        const end = Number(ref.getAttribute('end'));
        return {
            begin, end,
            type: ref.getAttribute('type'),
            value: text.slice(begin, end),
            uri: ref.getAttribute('uri')
        };
    }).filter(r => r);
}

/**
 * @param {Element} stanza
 */
export function getReceiptId (stanza) {
    const receipt = sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, stanza).pop();
    return receipt?.getAttribute('id');
}

/**
 * Determines whether the passed in stanza is a XEP-0280 Carbon
 * @param {Element} stanza - The message stanza
 * @returns {Boolean}
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
 * @param {Element} stanza - The message stanza
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

/**
 * @param {Element} stanza
 * @param {Object} attrs
 */
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
 * @param { Element } stanza
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
 * @method getChatMarker
 * @param {Element} stanza - The message stanza
 * @returns {Element}
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

/**
 * @param {Element} stanza
 */
export function isHeadline (stanza) {
    return stanza.getAttribute('type') === 'headline';
}

/**
 * @param {Element} stanza
 */
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
 * @method isArchived
 * @param {Element} original_stanza - The message stanza
 * @returns {boolean}
 */
export function isArchived (original_stanza) {
    return !!sizzle(`message > result[xmlns="${Strophe.NS.MAM}"]`, original_stanza).pop();
}

/**
 * @typedef {Object} XFormReportedField
 * @property {string} var
 * @property {string} label
 *
 * @typedef {Object} XFormResultItemField
 * @property {string} var
 * @property {string} value
 *
 * @typedef {Object} XFormOption
 * @property {string} value
 * @property {string} label
 * @property {boolean} selected
 * @property {boolean} required
 *
 * @typedef {Object} XFormCaptchaURI
 * @property {string} type
 * @property {string} data
 *
 * @typedef {'list-single'|'list-multi'} XFormListTypes
 * @typedef {'jid-single'|'jid-multi'} XFormJIDTypes
 * @typedef {'text-multi'|'text-private'|'text-single'} XFormTextTypes
 * @typedef {'date'|'datetime'} XFormDateTypes
 * @typedef {XFormListTypes|XFormJIDTypes|XFormTextTypes|XFormDateTypes|'fixed'|'boolean'|'url'|'hidden'} XFormFieldTypes
 *
 * @typedef {Object} XFormField
 * @property {string} var
 * @property {string} label
 * @property {XFormFieldTypes} [type]
 * @property {string} [text]
 * @property {string} [value]
 * @property {boolean} [required]
 * @property {boolean} [checked]
 * @property {XFormOption[]} [options]
 * @property {XFormCaptchaURI} [uri]
 * @property {boolean} readonly
 *
 * @typedef {'result'|'form'} XFormResponseType
 *
 * @typedef {Object} XForm
 * @property {XFormResponseType} type
 * @property {string} [title]
 * @property {string} [instructions]
 * @property {XFormReportedField[]} [reported]
 * @property {XFormResultItemField[][]} [items]
 * @property {XFormField[]} [fields]
 */

/**
 * @param {Element} field
 * @param {boolean} readonly
 * @param {Element} stanza
 * @return {XFormField}
 */
function parseXFormField(field, readonly, stanza) {
    const v = field.getAttribute('var');
    const label = field.getAttribute('label') || '';
    const type = field.getAttribute('type');
    const desc = field.querySelector('desc')?.textContent;
    const result = { readonly, desc };

    if (type === 'list-single' || type === 'list-multi') {
        const values = Array.from(field.querySelectorAll(':scope > value')).map((el) => el?.textContent);
        const options = Array.from(field.querySelectorAll(':scope > option')).map(
            (/** @type {HTMLElement} */ option) => {
                const value = option.querySelector('value')?.textContent;
                return {
                    value,
                    label: option.getAttribute('label'),
                    selected: values.includes(value),
                    required: !!field.querySelector('required'),
                    ...result,
                };
            }
        );
        return {
            type,
            options,
            label: field.getAttribute('label'),
            var: v,
            required: !!field.querySelector('required'),
            ...result,
        };
    } else if (type === 'fixed') {
        const text = field.querySelector('value')?.textContent;
        return { text, label, type, var: v, ...result };
    } else if (type === 'jid-multi') {
        return {
            type,
            var: v,
            label,
            value: field.querySelector('value')?.textContent,
            required: !!field.querySelector('required'),
            ...result,
        };
    } else if (type === 'boolean') {
        const value = field.querySelector('value')?.textContent;
        return {
            type,
            var: v,
            label,
            checked: ((value === '1' || value === 'true') && true) || false,
            ...result,
        };
    } else if (v === 'url') {
        return {
            var: v,
            label,
            value: field.querySelector('value')?.textContent,
            ...result,
        };
    } else if (v === 'username') {
        return {
            var: v,
            label,
            value: field.querySelector('value')?.textContent,
            required: !!field.querySelector('required'),
            type: getInputType(field),
            ...result,
        };
    } else if (v === 'password') {
        return {
            var: v,
            label,
            value: field.querySelector('value')?.textContent,
            required: !!field.querySelector('required'),
            ...result,
        };
    } else if (v === 'ocr') { // Captcha
        const uri = field.querySelector('uri');
        const el = sizzle('data[cid="' + uri.textContent.replace(/^cid:/, '') + '"]', stanza)[0];
        return {
            label: field.getAttribute('label'),
            var: v,
            uri: {
                type: uri.getAttribute('type'),
                data: el?.textContent,
            },
            required: !!field.querySelector('required'),
            ...result,
        };
    } else {
        return {
            label,
            var: v,
            required: !!field.querySelector('required'),
            value: field.querySelector('value')?.textContent,
            type: getInputType(field),
            ...result,
        };
    }
}

/**
 * @param {Element} field
 */
export function getInputType(field) {
    const type = XFORM_TYPE_MAP[field.getAttribute('type')]
    if (type == 'text') {
        const datatypes = field.getElementsByTagNameNS("http://jabber.org/protocol/xdata-validate", "validate");
        if (datatypes.length === 1) {
            const datatype = datatypes[0].getAttribute("datatype");
            return XFORM_VALIDATE_TYPE_MAP[datatype] || type;
        }
    }
    return type;
}

/**
* @param {Element} stanza
* @returns {XForm}
*/
export function parseXForm(stanza) {
    const xs = sizzle(`x[xmlns="${Strophe.NS.XFORM}"]`, stanza);
    if (xs.length > 1) {
        log.error(stanza);
        throw new Error('Invalid stanza');
    } else if (xs.length === 0) {
        return null;
    }

    const x = xs[0];
    const type = /** @type {XFormResponseType} */ (x.getAttribute('type'));
    const result = {
        type,
        title: x.querySelector('title')?.textContent,
    };

    if (type === 'result') {
        const reported = x.querySelector(':scope > reported');
        if (reported) {
            const reported_fields = reported ? Array.from(reported.querySelectorAll(':scope > field')) : [];
            const items = Array.from(x.querySelectorAll(':scope > item'));
            return /** @type {XForm} */({
                ...result,
                reported: /** @type {XFormReportedField[]} */ (reported_fields.map(getAttributes)),
                items: items.map((item) => {
                    return Array.from(item.querySelectorAll('field')).map((field) => {
                        return /** @type {XFormResultItemField} */ ({
                            ...getAttributes(field),
                            value: field.querySelector('value')?.textContent ?? '',
                        });
                    });
                }),
            });
        }
        return {
            ...result,
            fields: Array.from(x.querySelectorAll('field')).map((field) => parseXFormField(field, true, stanza)),
        };
    } else if (type === 'form') {
        return {
            ...result,
            instructions: x.querySelector('instructions')?.textContent,
            fields: Array.from(x.querySelectorAll('field')).map((field) => parseXFormField(field, false, stanza)),
        };
    } else {
        throw new Error(`Invalid type in XForm response stanza: ${type}`);
    }
}
