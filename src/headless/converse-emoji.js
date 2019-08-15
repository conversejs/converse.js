// Converse.js
// https://conversejs.org
//
// Copyright (c) 2012-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-emoji
 */
import * as twemoji from "twemoji";
import _ from "./lodash.noconflict";
import converse from "./converse-core";

const { Strophe } = converse.env;
const u = converse.env.utils;

const ASCII_LIST = {
    '*\\0/*':'1f646',
    '*\\O/*':'1f646',
    '-___-':'1f611',
    ':\'-)':'1f602',
    '\':-)':'1f605',
    '\':-D':'1f605',
    '>:-)':'1f606',
    '\':-(':'1f613',
    '>:-(':'1f620',
    ':\'-(':'1f622',
    'O:-)':'1f607',
    '0:-3':'1f607',
    '0:-)':'1f607',
    '0;^)':'1f607',
    'O;-)':'1f607',
    '0;-)':'1f607',
    'O:-3':'1f607',
    '-__-':'1f611',
    ':-Þ':'1f61b',
    '</3':'1f494',
    ':\')':'1f602',
    ':-D':'1f603',
    '\':)':'1f605',
    '\'=)':'1f605',
    '\':D':'1f605',
    '\'=D':'1f605',
    '>:)':'1f606',
    '>;)':'1f606',
    '>=)':'1f606',
    ';-)':'1f609',
    '*-)':'1f609',
    ';-]':'1f609',
    ';^)':'1f609',
    '\':(':'1f613',
    '\'=(':'1f613',
    ':-*':'1f618',
    ':^*':'1f618',
    '>:P':'1f61c',
    'X-P':'1f61c',
    '>:[':'1f61e',
    ':-(':'1f61e',
    ':-[':'1f61e',
    '>:(':'1f620',
    ':\'(':'1f622',
    ';-(':'1f622',
    '>.<':'1f623',
    '#-)':'1f635',
    '%-)':'1f635',
    'X-)':'1f635',
    '\\0/':'1f646',
    '\\O/':'1f646',
    '0:3':'1f607',
    '0:)':'1f607',
    'O:)':'1f607',
    'O=)':'1f607',
    'O:3':'1f607',
    'B-)':'1f60e',
    '8-)':'1f60e',
    'B-D':'1f60e',
    '8-D':'1f60e',
    '-_-':'1f611',
    '>:\\':'1f615',
    '>:/':'1f615',
    ':-/':'1f615',
    ':-.':'1f615',
    ':-P':'1f61b',
    ':Þ':'1f61b',
    ':-b':'1f61b',
    ':-O':'1f62e',
    'O_O':'1f62e',
    '>:O':'1f62e',
    ':-X':'1f636',
    ':-#':'1f636',
    ':-)':'1f642',
    '(y)':'1f44d',
    '<3':'2764',
    ':D':'1f603',
    '=D':'1f603',
    ';)':'1f609',
    '*)':'1f609',
    ';]':'1f609',
    ';D':'1f609',
    ':*':'1f618',
    '=*':'1f618',
    ':(':'1f61e',
    ':[':'1f61e',
    '=(':'1f61e',
    ':@':'1f620',
    ';(':'1f622',
    'D:':'1f628',
    ':$':'1f633',
    '=$':'1f633',
    '#)':'1f635',
    '%)':'1f635',
    'X)':'1f635',
    'B)':'1f60e',
    '8)':'1f60e',
    ':/':'1f615',
    ':\\':'1f615',
    '=/':'1f615',
    '=\\':'1f615',
    ':L':'1f615',
    '=L':'1f615',
    ':P':'1f61b',
    '=P':'1f61b',
    ':b':'1f61b',
    ':O':'1f62e',
    ':X':'1f636',
    ':#':'1f636',
    '=X':'1f636',
    '=#':'1f636',
    ':)':'1f642',
    '=]':'1f642',
    '=)':'1f642',
    ':]':'1f642'
};


const ASCII_REGEX = '(\\*\\\\0\\/\\*|\\*\\\\O\\/\\*|\\-___\\-|\\:\'\\-\\)|\'\\:\\-\\)|\'\\:\\-D|\\>\\:\\-\\)|>\\:\\-\\)|\'\\:\\-\\(|\\>\\:\\-\\(|>\\:\\-\\(|\\:\'\\-\\(|O\\:\\-\\)|0\\:\\-3|0\\:\\-\\)|0;\\^\\)|O;\\-\\)|0;\\-\\)|O\\:\\-3|\\-__\\-|\\:\\-Þ|\\:\\-Þ|\\<\\/3|<\\/3|\\:\'\\)|\\:\\-D|\'\\:\\)|\'\\=\\)|\'\\:D|\'\\=D|\\>\\:\\)|>\\:\\)|\\>;\\)|>;\\)|\\>\\=\\)|>\\=\\)|;\\-\\)|\\*\\-\\)|;\\-\\]|;\\^\\)|\'\\:\\(|\'\\=\\(|\\:\\-\\*|\\:\\^\\*|\\>\\:P|>\\:P|X\\-P|\\>\\:\\[|>\\:\\[|\\:\\-\\(|\\:\\-\\[|\\>\\:\\(|>\\:\\(|\\:\'\\(|;\\-\\(|\\>\\.\\<|>\\.<|#\\-\\)|%\\-\\)|X\\-\\)|\\\\0\\/|\\\\O\\/|0\\:3|0\\:\\)|O\\:\\)|O\\=\\)|O\\:3|B\\-\\)|8\\-\\)|B\\-D|8\\-D|\\-_\\-|\\>\\:\\\\|>\\:\\\\|\\>\\:\\/|>\\:\\/|\\:\\-\\/|\\:\\-\\.|\\:\\-P|\\:Þ|\\:Þ|\\:\\-b|\\:\\-O|O_O|\\>\\:O|>\\:O|\\:\\-X|\\:\\-#|\\:\\-\\)|\\(y\\)|\\<3|<3|\\:D|\\=D|;\\)|\\*\\)|;\\]|;D|\\:\\*|\\=\\*|\\:\\(|\\:\\[|\\=\\(|\\:@|;\\(|D\\:|\\:\\$|\\=\\$|#\\)|%\\)|X\\)|B\\)|8\\)|\\:\\/|\\:\\\\|\\=\\/|\\=\\\\|\\:L|\\=L|\\:P|\\=P|\\:b|\\:O|\\:X|\\:#|\\=X|\\=#|\\:\\)|\\=\\]|\\=\\)|\\:\\])';
const ASCII_REPLACE_REGEX = new RegExp("<object[^>]*>.*?<\/object>|<span[^>]*>.*?<\/span>|<(?:object|embed|svg|img|div|span|p|a)[^>]*>|((\\s|^)"+ASCII_REGEX+"(?=\\s|$|[!,.?]))", "gi");


function convert (unicode) {
    // Converts unicode code points and code pairs
    // to their respective characters
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
    return twemoji.default.convert.fromCodePoint(unicode);
}


converse.plugins.add('converse-emoji', {

    async initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;
        const { __ } = _converse;

        _converse.api.settings.update({
            'emoji_image_path': twemoji.default.base,
            'emoji_json_path': '/dist/emojis.json',
            'emoji_categories': {
                "smileys": ":grinning:",
                "people": ":thumbsup:",
                "activity": ":soccer:",
                "travel": ":motorcycle:",
                "objects": ":bomb:",
                "nature": ":rainbow:",
                "food": ":hotdog:",
                "symbols": ":musical_note:",
                "flags": ":flag_ac:"
            }
        });
        _converse.api.promises.add(['emojisInitialized']);
        twemoji.default.base = _converse.emoji_image_path;

        _converse.emoji_category_labels = {
            "smileys": __("Smileys and emotions"),
            "people": __("People"),
            "activity": __("Activities"),
            "travel": __("Travel"),
            "objects": __("Objects"),
            "nature": __("Animals and nature"),
            "food": __("Food and drink"),
            "symbols": __("Symbols"),
            "flags": __("Flags")
        }

        _converse.emojis = {};

        u.getEmojiRenderer = function () {
            const how = {
                'attributes': (icon, variant) => {
                    const codepoint = twemoji.default.convert.toCodePoint(icon);
                    return {'title': `${u.getEmojisByAtrribute('cp')[codepoint]['sn']} ${icon}`}
                }
            };
            const toUnicode = u.shortnameToUnicode;
            return _converse.use_system_emojis ? toUnicode: text => twemoji.default.parse(toUnicode(text), how);
        };

        u.addEmoji = function (text) {
            return u.getEmojiRenderer()(text);
        }

        function getTonedEmojis () {
            if (!_converse.toned_emojis) {
                _converse.toned_emojis = _.uniq(
                    u.getEmojisByCategory().people
                        .filter(person => person.sn.includes('_tone'))
                        .map(person => person.sn.replace(/_tone[1-5]/, ''))
                );
            }
            return _converse.toned_emojis;
        }

        function getShortNames () {
            const shortnames = [];
            for (const emoji in _converse.emojis.json) {
                if (!Object.prototype.hasOwnProperty.call(_converse.emojis.json, emoji) || (emoji === '')) continue;
                shortnames.push(emoji.replace(/[+]/g, "\\$&"));
                for (let i = 0; i < _converse.emojis.json[emoji].sns.length; i++) {
                    shortnames.push(_converse.emojis.json[emoji].sns[i].replace(/[+]/g, "\\$&"));
                }
            }
            return shortnames.join('|');
        }

        function fetchEmojiJSON () {
            _converse.emojis.json = {};
            const promise = u.getResolveablePromise();
            const xhr = new XMLHttpRequest();
            xhr.open('GET', _converse.emoji_json_path, true);
            xhr.setRequestHeader('Accept', "application/json, text/javascript");
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 400) {
                    try {
                        _converse.emojis.json = JSON.parse(xhr.responseText);
                    } catch (e) {
                        xhr.onerror(e);
                    }
                } else {
                    xhr.onerror();
                }
                promise.resolve();
            };
            xhr.onerror = (e) => {
                const err_message = e ? ` Error: ${e.message}` : '';
                _converse.log(
                    `Could not fetch Emoji JSON. Status: ${xhr.statusText}. ${err_message}`,
                    Strophe.LogLevel.ERROR
                );
                promise.resolve();
            }
            xhr.send();
            return promise;
        }


        /************************ BEGIN Utils ************************/
        // Closured cache
        const emojis_by_attribute = {};

        Object.assign(u, {
            /**
             * @method u.shortnameToUnicode
             * Returns unicode represented by the passed in shortname.
             * @param {string} str - String containg the shortname(s)
             */
            shortnameToUnicode (str) {
                str = str.replace(_converse.emojis.shortnames_regex, shortname => {
                    if( (typeof shortname === 'undefined') || (shortname === '') || (!(shortname in _converse.emojis.json)) ) {
                        // if the shortname doesnt exist just return the entire match
                        return shortname;
                    }
                    const unicode = _converse.emojis.json[shortname].cp.toUpperCase();
                    return convert(unicode);
                });
                // Also replace ASCII smileys
                str = str.replace(ASCII_REPLACE_REGEX, (entire, m1, m2, m3) => {
                    if( (typeof m3 === 'undefined') || (m3 === '') || (!(u.unescapeHTML(m3) in ASCII_LIST)) ) {
                        // if the ascii doesnt exist just return the entire match
                        return entire;
                    }
                    m3 = u.unescapeHTML(m3);
                    const unicode = ASCII_LIST[m3].toUpperCase();
                    return m2+convert(unicode);
                });
                return str;
            },

            /**
             * Determines whether the passed in string is just a single emoji shortname;
             * @method u.isSingleEmoji
             * @param {string} shortname - A string which migh be just an emoji shortname
             * @returns {boolean}
             */
            isSingleEmoji (shortname) {
                shortname = shortname.trim();
                if (!shortname || (shortname.length > 2 && !shortname.startsWith(':'))) {
                    return;
                }
                const result = twemoji.default.parse(u.shortnameToUnicode(shortname));
                const match = result.match(/<img class="emoji" draggable="false" alt=".*?" src=".*?\.png"\/>/);
                return match && match.length === 1;
            },

            /**
             * @method u.getEmojisByAtrribute
             * @param {string} attr - The attribute according to which the
             *  returned map should be keyed.
             * @returns {object} - Map of emojis with the passed in attribute values
             *  as keys and a list of emojis for a particular category as values.
             */
            getEmojisByAtrribute (attr) {
                if (emojis_by_attribute[attr]) {
                    return emojis_by_attribute[attr];
                }
                if (attr === 'category') {
                    return u.getEmojisByCategory();
                }
                emojis_by_attribute[attr] = {};
                const all_variants = _converse.emojis_list
                    .map(e => e[attr])
                    .filter((c, i, arr) => arr.indexOf(c) == i);

                all_variants.forEach(v => {
                    emojis_by_attribute[attr][v] = _.find(_converse.emojis_list, i => (i[attr] === v));
                });
                return emojis_by_attribute[attr];
            },

            /**
             * @method u.getEmojisByCategory
             * @returns {object} - Map of emojis with categories as keys
             *  and a list of emojis for a particular category as values.
             */
            getEmojisByCategory () {
                if (emojis_by_attribute['category']) {
                    return emojis_by_attribute['category'];
                }
                const tones = [':tone1:', ':tone2:', ':tone3:', ':tone4:', ':tone5:'];
                const excluded = [':kiss_ww:', ':kiss_mm:', ':kiss_woman_man:'];
                const excluded_substrings = [':woman', ':man', ':women_', ':men_', '_man_', '_woman_', '_woman:', '_man:'];
                const is_excluded = sn => [...tones, ...excluded].includes(sn);
                const has_excluded_substring = sn => excluded_substrings.reduce((out, str) => (out || sn.includes(str)), false);
                emojis_by_attribute['category'] = {};
                _converse.emojis.all_categories.forEach(cat => {
                    let list = _.sortBy(_converse.emojis_list.filter(e => e.c === cat), ['cp']);
                    list = list.filter(item => (!is_excluded(item.sn) && !has_excluded_substring(item.sn)));
                    if (cat === 'smileys') {
                        const idx = _.findIndex(list, ['cp', '1f600']);
                        list = _.union(_.slice(list, idx), _.slice(list, 0, idx+1));
                    }
                    emojis_by_attribute['category'][cat] = list;
                });
                return emojis_by_attribute['category'];
            }
        });
        /************************ END Utils ************************/

        await fetchEmojiJSON();
        _converse.emojis.shortnames_regex = new RegExp("<object[^>]*>.*?<\/object>|<span[^>]*>.*?<\/span>|<(?:object|embed|svg|img|div|span|p|a)[^>]*>|("+getShortNames()+")", "gi");
        _converse.emojis_list = Object.values(_converse.emojis.json);

        const excluded_categories = ['modifier', 'regional'];
        _converse.emojis.all_categories = _converse.emojis_list
                .map(e => e.c)
                .filter((c, i, arr) => arr.indexOf(c) == i)
                .filter(c => !excluded_categories.includes(c));

        _converse.emojis.toned = getTonedEmojis();

        /**
         * Triggered once the JSON file representing emoji data has been
         * fetched and its save to start calling emoji utility methods.
         * @event _converse#emojisInitialized
         */
        _converse.api.trigger('emojisInitialized');
    }
});
