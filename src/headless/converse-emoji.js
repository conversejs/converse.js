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

const { Backbone, } = converse.env;
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

        /**
         * Model for storing data related to the Emoji picker widget
         * @class
         * @namespace _converse.EmojiPicker
         * @memberOf _converse
         */
        _converse.EmojiPicker = Backbone.Model.extend({
            defaults: {
                'current_category': 'smileys',
                'current_skintone': '',
                'scroll_position': 0
            }
        });

        _converse.emojis = {};

        function getTonedEmojis () {
            if (!_converse.toned_emojis) {
                _converse.toned_emojis = _.uniq(
                    Object.values(_converse.emojis.json.people)
                        .filter(person => person.sn.includes('_tone'))
                        .map(person => person.sn.replace(/_tone[1-5]/, ''))
                );
            }
            return _converse.toned_emojis;
        }


        /************************ BEGIN Utils ************************/
        // Closured cache
        const emojis_by_attribute = {};

        Object.assign(u, {

            /**
             * Replaces emoji shortnames in the passed-in string with unicode or image-based emojis
             * (based on the value of `use_system_emojis`).
             * @method u.addEmoji
             * @param {string} text = The text
             * @returns {string} The text with shortnames replaced with emoji
             *  unicodes or images.
             */
            addEmoji (text) {
                return u.getEmojiRenderer()(text);
            },

            /**
             * Based on the value of `use_system_emojis` will return either
             * a function that converts emoji shortnames into unicode glyphs
             * (see {@link u.shortnameToUnicode} or one that converts them into images.
             * unicode emojis
             * @method u.getEmojiRenderer
             * @returns {function}
             */
            getEmojiRenderer () {
                const how = {
                    'attributes': (icon) => {
                        const codepoint = twemoji.default.convert.toCodePoint(icon);
                        return {'title': `${u.getEmojisByAtrribute('cp')[codepoint]['sn']} ${icon}`}
                    }
                };
                const toUnicode = u.shortnameToUnicode;
                return _converse.use_system_emojis ? toUnicode: text => twemoji.default.parse(toUnicode(text), how);
            },

            /**
             * Returns unicode represented by the passed in shortname.
             * @method u.shortnameToUnicode
             * @param {string} str - String containg the shortname(s)
             */
            shortnameToUnicode (str) {
                str = str.replace(_converse.emojis.shortnames_regex, shortname => {
                    if ((typeof shortname === 'undefined') || (shortname === '') || (!_converse.emoji_shortnames.includes(shortname))) {
                        // if the shortname doesnt exist just return the entire match
                        return shortname;
                    }
                    const unicode = _converse.emojis_map[shortname].cp.toUpperCase();
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
             * @method u.isOnlyEmojis
             * @param {string} shortname - A string which migh be just an emoji shortname
             * @returns {boolean}
             */
            isOnlyEmojis (text) {
                const words = text.trim().split(/\s+/);
                if (words.length === 0 || words.length > 3) {
                    return false;
                }
                const rejects = words.filter(text => {
                    const result = twemoji.default.parse(u.shortnameToUnicode(text));
                    const match = result.match(/<img class="emoji" draggable="false" alt=".*?" src=".*?\.png"\/>/);
                    return !match || match.length !== 1;
                });
                return rejects.length === 0;
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
                    return _converse.emojis.json;
                }
                const all_variants = _converse.emojis_list
                    .map(e => e[attr])
                    .filter((c, i, arr) => arr.indexOf(c) == i);

                emojis_by_attribute[attr] = {};
                all_variants.forEach(v => (emojis_by_attribute[attr][v] = _.find(_converse.emojis_list, i => (i[attr] === v))));
                return emojis_by_attribute[attr];
            }
        });
        /************************ END Utils ************************/

        const { default: json } = await import(/*webpackChunkName: "emojis" */ './emojis.json');
        _converse.emojis.json = json;
        _converse.emojis.categories = Object.keys(_converse.emojis.json);
        _converse.emojis_map = _converse.emojis.categories.reduce((result, cat) => Object.assign(result, _converse.emojis.json[cat]), {});
        _converse.emojis_list = Object.values(_converse.emojis_map);
        _converse.emojis_list.sort((a, b) => a.sn < b.sn ? -1 : (a.sn > b.sn ? 1 : 0));
        _converse.emoji_shortnames = _converse.emojis_list.map(m => m.sn);

        const getShortNames = () => _converse.emoji_shortnames.map(s => s.replace(/[+]/g, "\\$&")).join('|');
        _converse.emojis.shortnames_regex = new RegExp("<object[^>]*>.*?<\/object>|<span[^>]*>.*?<\/span>|<(?:object|embed|svg|img|div|span|p|a)[^>]*>|("+getShortNames()+")", "gi");


        _converse.emojis.toned = getTonedEmojis();

        /**
         * Triggered once the JSON file representing emoji data has been
         * fetched and its save to start calling emoji utility methods.
         * @event _converse#emojisInitialized
         */
        _converse.api.trigger('emojisInitialized');


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('clearSession', () => {
            if (_converse.emojipicker) {
                _converse.emojipicker.browserStorage._clear();
                _converse.emojipicker.destroy();
                delete _converse.emojipicker
            }
        });
        /************************ END Event Handlers ************************/
    }
});
