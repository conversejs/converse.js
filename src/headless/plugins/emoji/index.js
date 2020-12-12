/**
 * @module converse-emoji
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { ASCII_REPLACE_REGEX, CODEPOINTS_REGEX } from './regexes.js';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "../../core.js";
import { html } from 'lit-html';

const u = converse.env.utils;

converse.emojis = {
    'initialized': false,
    'initialized_promise': u.getResolveablePromise()
};


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

function unique (arr) {
    return [...new Set(arr)];
}

function getTonedEmojis () {
    if (!converse.emojis.toned) {
        converse.emojis.toned = unique(
            Object.values(converse.emojis.json.people)
                .filter(person => person.sn.includes('_tone'))
                .map(person => person.sn.replace(/_tone[1-5]/, ''))
        );
    }
    return converse.emojis.toned;
}


export function convertASCII2Emoji (str) {
    // Replace ASCII smileys
    return str.replace(ASCII_REPLACE_REGEX, (entire, m1, m2, m3) => {
        if( (typeof m3 === 'undefined') || (m3 === '') || (!(u.unescapeHTML(m3) in ASCII_LIST)) ) {
            // if the ascii doesnt exist just return the entire match
            return entire;
        }
        m3 = u.unescapeHTML(m3);
        const unicode = ASCII_LIST[m3].toUpperCase();
        return m2+convert(unicode);
    });
}


export function getEmojiMarkup (data, options={unicode_only: false, add_title_wrapper: false}) {
    const emoji = data.emoji;
    const shortname = data.shortname;
    if (emoji) {
        if (options.unicode_only) {
            return emoji;
        } else if (api.settings.get('use_system_emojis')) {
            if (options.add_title_wrapper) {
                return shortname ? html`<span title="${shortname}">${emoji}</span>` : emoji;
            } else {
                return emoji;
            }
        } else {
            const path = api.settings.get('emoji_image_path');
            return html`<img class="emoji"
                draggable="false"
                title="${shortname}"
                alt="${emoji}"
                src="${path}/72x72/${data.cp}.png"/>`;
        }
    } else if (options.unicode_only) {
        return shortname;
    } else {
        return html`<img class="emoji"
            draggable="false"
            title="${shortname}"
            alt="${shortname}"
            src="${converse.emojis.by_sn[shortname].url}">`;
    }
}


export function getShortnameReferences (text) {
    if (!converse.emojis.initialized) {
        throw new Error(
            'getShortnameReferences called before emojis are initialized. '+
            'To avoid this problem, first await the converse.emojis.initilaized_promise.'
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
            'shortname': u.getEmojisByAtrribute('cp')[icon_id]?.sn || ''
        });
    });
    return references;
}


function addEmojisMarkup (text, options) {
    let list = [text];
    [...getShortnameReferences(text), ...getCodePointReferences(text)]
        .sort((a, b) => b.begin - a.begin)
        .forEach(ref => {
            const text = list.shift();
            const emoji = getEmojiMarkup(ref, options);
            if (typeof emoji === 'string') {
                list = [text.slice(0, ref.begin) + emoji + text.slice(ref.end), ...list];
            } else {
                list = [text.slice(0, ref.begin), emoji, text.slice(ref.end), ...list];
            }
        });
    return list;
}


converse.plugins.add('converse-emoji', {

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { ___ } = _converse;

        api.settings.extend({
            'emoji_image_path': 'https://twemoji.maxcdn.com/v/12.1.6/',
            'emoji_categories': {
                "smileys": ":grinning:",
                "people": ":thumbsup:",
                "activity": ":soccer:",
                "travel": ":motorcycle:",
                "objects": ":bomb:",
                "nature": ":rainbow:",
                "food": ":hotdog:",
                "symbols": ":musical_note:",
                "flags": ":flag_ac:",
                "custom": null
            },
            // We use the triple-underscore method which doesn't actually
            // translate but does signify to gettext that these strings should
            // go into the POT file. The translation then happens in the
            // template. We do this so that users can pass in their own
            // strings via converse.initialize, which is before __ is
            // available.
            'emoji_category_labels': {
                "smileys": ___("Smileys and emotions"),
                "people": ___("People"),
                "activity": ___("Activities"),
                "travel": ___("Travel"),
                "objects": ___("Objects"),
                "nature": ___("Animals and nature"),
                "food": ___("Food and drink"),
                "symbols": ___("Symbols"),
                "flags": ___("Flags"),
                "custom": ___("Stickers")
            }
        });


        /**
         * Model for storing data related to the Emoji picker widget
         * @class
         * @namespace _converse.EmojiPicker
         * @memberOf _converse
         */
        _converse.EmojiPicker = Model.extend({
            defaults: {
                'current_category': 'smileys',
                'current_skintone': '',
                'scroll_position': 0
            }
        });

        /************************ BEGIN Utils ************************/
        // Closured cache
        const emojis_by_attribute = {};

        Object.assign(u, {
            /**
             * Returns an emoji represented by the passed in shortname.
             * Scans the passed in text for shortnames and replaces them with
             * emoji unicode glyphs or alternatively if it's a custom emoji
             * without unicode representation then a lit-html TemplateResult
             * which represents image tag markup is returned.
             *
             * The shortname needs to be defined in `emojis.json`
             * and needs to have either a `cp` attribute for the codepoint, or
             * an `url` attribute which points to the source for the image.
             *
             * @method u.shortnamesToEmojis
             * @param { String } str - String containg the shortname(s)
             * @param { Object } options
             * @param { Boolean } options.unicode_only - Whether emojis are rendered as
             *  unicode codepoints. If so, the returned result will be an array
             *  with containing one string, because the emojis themselves will
             *  also be strings. If set to false, emojis will be represented by
             *  lit-html TemplateResult objects.
             * @param { Boolean } options.add_title_wrapper - Whether unicode
             *  codepoints should be wrapped with a `<span>` element with a
             *  title, so that the shortname is shown upon hovering with the
             *  mouse.
             * @returns {Array} An array of at least one string, or otherwise
             * strings and lit-html TemplateResult objects.
             */
            shortnamesToEmojis (str, options={unicode_only: false, add_title_wrapper: false}) {
                str = convertASCII2Emoji(str);
                return addEmojisMarkup(str, options);
            },

            /**
             * Replaces all shortnames in the passed in string with their
             * unicode (emoji) representation.
             * @method u.shortnamesToUnicode
             * @param { String } str - String containing the shortname(s)
             * @returns { String }
             */
            shortnamesToUnicode (str) {
                return u.shortnamesToEmojis(str, {'unicode_only': true})[0];
            },

            /**
             * Determines whether the passed in string is just a single emoji shortname;
             * @method u.isOnlyEmojis
             * @param { String } shortname - A string which migh be just an emoji shortname
             * @returns { Boolean }
             */
            isOnlyEmojis (text) {
                const words = text.trim().split(/\s+/);
                if (words.length === 0 || words.length > 3) {
                    return false;
                }
                const emojis = words.filter(text => {
                    const refs = getCodePointReferences(u.shortnamesToUnicode(text));
                    return refs.length === 1 && (text === refs[0]['shortname'] || text === refs[0]['emoji']);
                });
                return emojis.length === words.length;
            },

            /**
             * @method u.getEmojisByAtrribute
             * @param { String } attr - The attribute according to which the
             *  returned map should be keyed.
             * @returns { Object } - Map of emojis with the passed in attribute values
             *  as keys and a list of emojis for a particular category as values.
             */
            getEmojisByAtrribute (attr) {
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
        });
        /************************ END Utils ************************/


        /************************ BEGIN API ************************/
        // We extend the default converse.js API to add methods specific to MUC groupchats.
        Object.assign(api, {
            /**
             * @namespace api.emojis
             * @memberOf api
             */
            emojis: {
                /**
                 * Initializes Emoji support by downloading the emojis JSON (and any applicable images).
                 * @method api.emojis.initialize
                 * @returns {Promise}
                 */
                async initialize () {
                    if (!converse.emojis.initialized) {
                        converse.emojis.initialized = true;
                        const { default: json } = await import(/*webpackChunkName: "emojis" */ './emoji.json');
                        converse.emojis.json = json;
                        converse.emojis.by_sn = Object.keys(json).reduce((result, cat) => Object.assign(result, json[cat]), {});
                        converse.emojis.list = Object.values(converse.emojis.by_sn);
                        converse.emojis.list.sort((a, b) => a.sn < b.sn ? -1 : (a.sn > b.sn ? 1 : 0));
                        converse.emojis.shortnames = converse.emojis.list.map(m => m.sn);
                        const getShortNames = () => converse.emojis.shortnames.map(s => s.replace(/[+]/g, "\\$&")).join('|');
                        converse.emojis.shortnames_regex = new RegExp(getShortNames(), "gi");
                        converse.emojis.toned = getTonedEmojis();
                        converse.emojis.initialized_promise.resolve();
                    }
                    return converse.emojis.initialized_promise;
                }
            }
        });
    }
});
