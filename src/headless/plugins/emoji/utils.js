import { ASCII_REPLACE_REGEX, CODEPOINTS_REGEX } from './regexes.js';
import { converse } from "../../core.js";

const { u } = converse.env;

// Closured cache
const emojis_by_attribute = {};


const ASCII_LIST = {
    '*\\0/*':'1f646', '*\\O/*':'1f646', '-___-':'1f611', ':\'-)':'1f602', '\':-)':'1f605', '\':-D':'1f605', '>:-)':'1f606', '\':-(':'1f613',
    '>:-(':'1f620', ':\'-(':'1f622', 'O:-)':'1f607', '0:-3':'1f607', '0:-)':'1f607', '0;^)':'1f607', 'O;-)':'1f607', '0;-)':'1f607', 'O:-3':'1f607',
    '-__-':'1f611', ':-Þ':'1f61b', '</3':'1f494', ':\')':'1f602', ':-D':'1f603', '\':)':'1f605', '\'=)':'1f605', '\':D':'1f605', '\'=D':'1f605',
    '>:)':'1f606', '>;)':'1f606', '>=)':'1f606', ';-)':'1f609', '*-)':'1f609', ';-]':'1f609', ';^)':'1f609', '\':(':'1f613', '\'=(':'1f613',
    ':-*':'1f618', ':^*':'1f618', '>:P':'1f61c', 'X-P':'1f61c', '>:[':'1f61e', ':-(':'1f61e', ':-[':'1f61e', '>:(':'1f620', ':\'(':'1f622',
    ';-(':'1f622', '>.<':'1f623', '#-)':'1f635', '%-)':'1f635', 'X-)':'1f635', '\\0/':'1f646', '\\O/':'1f646', '0:3':'1f607', '0:)':'1f607',
    'O:)':'1f607', 'O=)':'1f607', 'O:3':'1f607', 'B-)':'1f60e', '8-)':'1f60e', 'B-D':'1f60e', '8-D':'1f60e', '-_-':'1f611', '>:\\':'1f615',
    '>:/':'1f615', ':-/':'1f615', ':-.':'1f615', ':-P':'1f61b', ':Þ':'1f61b', ':-b':'1f61b', ':-O':'1f62e', 'O_O':'1f62e', '>:O':'1f62e',
    ':-X':'1f636', ':-#':'1f636', ':-)':'1f642', '(y)':'1f44d', '<3':'2764', ':D':'1f603', '=D':'1f603', ';)':'1f609', '*)':'1f609',
    ';]':'1f609', ';D':'1f609', ':*':'1f618', '=*':'1f618', ':(':'1f61e', ':[':'1f61e', '=(':'1f61e', ':@':'1f620', ';(':'1f622', 'D:':'1f628',
    ':$':'1f633', '=$':'1f633', '#)':'1f635', '%)':'1f635', 'X)':'1f635', 'B)':'1f60e', '8)':'1f60e', ':/':'1f615', ':\\':'1f615', '=/':'1f615',
    '=\\':'1f615', ':L':'1f615', '=L':'1f615', ':P':'1f61b', '=P':'1f61b', ':b':'1f61b', ':O':'1f62e', ':X':'1f636', ':#':'1f636', '=X':'1f636',
    '=#':'1f636', ':)':'1f642', '=]':'1f642', '=)':'1f642', ':]':'1f642'
};


function toCodePoint(unicode_surrogates) {
    const r = [];
    let  p = 0;
    let  i = 0;
    while (i < unicode_surrogates.length) {
        const c = unicode_surrogates.charCodeAt(i++);
        if (p) {
            r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
            p = 0;
        } else if (0xD800 <= c && c <= 0xDBFF) {
            p = c;
        } else {
            r.push(c.toString(16));
        }
    }
    return r.join('-');
}


function fromCodePoint (codepoint) {
    let code = typeof codepoint === 'string' ? parseInt(codepoint, 16) : codepoint;
    if (code < 0x10000) {
        return String.fromCharCode(code);
    }
    code -= 0x10000;
    return String.fromCharCode(
        0xD800 + (code >> 10),
        0xDC00 + (code & 0x3FF)
    );
}


function convert (unicode) {
    // Converts unicode code points and code pairs to their respective characters
    if (unicode.indexOf("-") > -1) {
        const parts = [],
              s = unicode.split('-');
        for (let i = 0; i < s.length; i++) {
            let part = parseInt(s[i], 16);
            if (part >= 0x10000 && part <= 0x10FFFF) {
                const hi = Math.floor((part - 0x10000) / 0x400) + 0xD800;
                const lo = ((part - 0x10000) % 0x400) + 0xDC00;
                part = (String.fromCharCode(hi) + String.fromCharCode(lo));
            } else {
                part = String.fromCharCode(part);
            }
            parts.push(part);
        }
        return parts.join('');
    }
    return fromCodePoint(unicode);
}

export function convertASCII2Emoji (str) {
    // Replace ASCII smileys
    return str.replace(ASCII_REPLACE_REGEX, (entire, _, m2, m3) => {
        if( (typeof m3 === 'undefined') || (m3 === '') || (!(u.unescapeHTML(m3) in ASCII_LIST)) ) {
            // if the ascii doesnt exist just return the entire match
            return entire;
        }
        m3 = u.unescapeHTML(m3);
        const unicode = ASCII_LIST[m3].toUpperCase();
        return m2+convert(unicode);
    });
}

export function getShortnameReferences (text) {
    if (!converse.emojis.initialized) {
        throw new Error(
            'getShortnameReferences called before emojis are initialized. '+
            'To avoid this problem, first await the converse.emojis.initialized_promise'
        );
    }
    const references = [...text.matchAll(converse.emojis.shortnames_regex)].filter(ref => ref[0].length > 0);
    return references.map(ref => {
        const cp = converse.emojis.by_sn[ref[0]].cp;
        return {
            cp,
            'begin': ref.index,
            'end': ref.index+ref[0].length,
            'shortname': ref[0],
            'emoji': cp ? convert(cp) : null
        }
    });
}


function parseStringForEmojis(str, callback) {
    const UFE0Fg = /\uFE0F/g;
    const U200D = String.fromCharCode(0x200D);
    return String(str).replace(CODEPOINTS_REGEX, (emoji, _, offset) => {
        const icon_id = toCodePoint(emoji.indexOf(U200D) < 0 ? emoji.replace(UFE0Fg, '') : emoji);
        if (icon_id) callback(icon_id, emoji, offset);
    });
}


export function getCodePointReferences (text) {
    const references = [];
    parseStringForEmojis(text, (icon_id, emoji, offset) => {
        references.push({
            'begin': offset,
            'cp': icon_id,
            'emoji': emoji,
            'end': offset + emoji.length,
            'shortname': getEmojisByAtrribute('cp')[icon_id]?.sn || ''
        });
    });
    return references;
}

function addEmojisMarkup (text) {
    let list = [text];
    [...getShortnameReferences(text), ...getCodePointReferences(text)]
        .sort((a, b) => b.begin - a.begin)
        .forEach(ref => {
            const text = list.shift();
            const emoji = ref.emoji || ref.shortname;
            list = [text.slice(0, ref.begin) + emoji + text.slice(ref.end), ...list];
        });
    return list;
}

/**
 * Replaces all shortnames in the passed in string with their
 * unicode (emoji) representation.
 * @namespace u
 * @method u.shortnamesToUnicode
 * @param { String } str - String containing the shortname(s)
 * @returns { String }
 */
function shortnamesToUnicode (str) {
    return addEmojisMarkup(convertASCII2Emoji(str)).pop();
}

/**
 * Determines whether the passed in string is just a single emoji shortname;
 * @namespace u
 * @method u.isOnlyEmojis
 * @param { String } shortname - A string which migh be just an emoji shortname
 * @returns { Boolean }
 */
function isOnlyEmojis (text) {
    const words = text.trim().split(/\s+/);
    if (words.length === 0 || words.length > 3) {
        return false;
    }
    const emojis = words.filter(text => {
        const refs = getCodePointReferences(u.shortnamesToUnicode(text));
        return refs.length === 1 && (text === refs[0]['shortname'] || text === refs[0]['emoji']);
    });
    return emojis.length === words.length;
}

/**
 * @namespace u
 * @method u.getEmojisByAtrribute
 * @param { 'category'|'cp'|'sn' } attr
 *  The attribute according to which the returned map should be keyed.
 * @returns { Object }
 *  Map of emojis with the passed in `attr` used as key and a list of emojis as values.
 */
function getEmojisByAtrribute (attr) {
    if (emojis_by_attribute[attr]) {
        return emojis_by_attribute[attr];
    }
    if (attr === 'category') {
        return converse.emojis.json;
    }
    const all_variants = converse.emojis.list
        .map(e => e[attr])
        .filter((c, i, arr) => arr.indexOf(c) == i);

    emojis_by_attribute[attr] = {};
    all_variants.forEach(v => (emojis_by_attribute[attr][v] = converse.emojis.list.find(i => i[attr] === v)));
    return emojis_by_attribute[attr];
}

Object.assign(u, {
    getEmojisByAtrribute,
    isOnlyEmojis,
    shortnamesToUnicode,
});
