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
import u from "./utils/core";

const { Strophe } = converse.env;

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
    /* For converting unicode code points and code pairs
     * to their respective characters
     */
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
            'emoji_json_path': '/dist/emojis.json'
        });
        _converse.api.promises.add(['emojisInitialized']);
        twemoji.default.base = _converse.emoji_image_path;

        _converse.emojis = {};

        u.getEmojiRenderer = function () {
            return _converse.use_system_emojis ? u.shortnameToUnicode : _.flow(u.shortnameToUnicode, twemoji.default.parse);
        };

        u.addEmoji = function (text) {
            return u.getEmojiRenderer()(text);
        }

        function getTonedEmojis () {
            if (!_converse.toned_emojis) {
                _converse.toned_emojis = _.uniq(
                    _.map(
                        _.filter(
                            _converse.emojis.by_category.people,
                            person => _.includes(person._shortname, '_tone')
                        ),
                        person => person._shortname.replace(/_tone[1-5]/, '')
                    )
                );
            }
            return _converse.toned_emojis;
        }

        function getEmojisByCategory () {
            /* Return a dict of emojis with the categories as keys and
             * lists of emojis in that category as values.
             */
            const emojis = Object.values(_.mapValues(_converse.emojis.json, function (value, key, o) {
                value._shortname = key;
                return value
            }));
            const tones = [':tone1:', ':tone2:', ':tone3:', ':tone4:', ':tone5:'];
            const excluded = [':kiss_ww:', ':kiss_mm:', ':kiss_woman_man:'];
            const excluded_substrings = [
                ':woman', ':man', ':women_', ':men_', '_man_', '_woman_', '_woman:', '_man:'
            ];
            const excluded_categories = ['modifier', 'regional'];
            const categories = _.difference(
                _.uniq(_.map(emojis, _.partial(_.get, _, 'category'))),
                excluded_categories
            );
            const emojis_by_category = {};
            _.forEach(categories, (cat) => {
                let list = _.sortBy(_.filter(emojis, ['category', cat]), ['uc_base']);
                list = _.filter(
                    list,
                    (item) => !_.includes(_.concat(tones, excluded), item._shortname) &&
                            !_.some(excluded_substrings, _.partial(_.includes, item._shortname))
                );
                if (cat === 'people') {
                    const idx = _.findIndex(list, ['uc_base', '1f600']);
                    list = _.union(_.slice(list, idx), _.slice(list, 0, idx+1));
                } else if (cat === 'activity') {
                    list = _.union(_.slice(list, 27-1), _.slice(list, 0, 27));
                } else if (cat === 'objects') {
                    list = _.union(_.slice(list, 24-1), _.slice(list, 0, 24));
                } else if (cat === 'travel') {
                    list = _.union(_.slice(list, 17-1), _.slice(list, 0, 17));
                } else if (cat === 'symbols') {
                    list = _.union(_.slice(list, 60-1), _.slice(list, 0, 60));
                }
                emojis_by_category[cat] = list;
            });
            return emojis_by_category;
        }

        u.isSingleEmoji = function (str) {
            str = str.trim();
            if (!str || (str.length > 2 && !str.startsWith(':'))) {
                return;
            }
            const result = _.flow(u.shortnameToUnicode, twemoji.default.parse)(str)
            const match = result.match(/<img class="emoji" draggable="false" alt=".*?" src=".*?\.png"\/>/);
            return match && match.length === 1;
        }

        /**
         * Returns unicode represented by the psased in shortname.
         * @private
         * @param {string} str - String containg the shortname(s)
         */
        u.shortnameToUnicode = function (str) {
            str = str.replace(_converse.emojis.shortnames_regex, shortname => {
                if( (typeof shortname === 'undefined') || (shortname === '') || (!(shortname in _converse.emojis.json)) ) {
                    // if the shortname doesnt exist just return the entire match
                    return shortname;
                }
                const unicode = _converse.emojis.json[shortname].uc_output.toUpperCase();
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
        }

        function getShortNames () {
            const shortnames = [];
            for (const emoji in _converse.emojis.json) {
                if (!Object.prototype.hasOwnProperty.call(_converse.emojis.json, emoji) || (emoji === '')) continue;
                shortnames.push(emoji.replace(/[+]/g, "\\$&"));
                for (let i = 0; i < _converse.emojis.json[emoji].shortnames.length; i++) {
                    shortnames.push(_converse.emojis.json[emoji].shortnames[i].replace(/[+]/g, "\\$&"));
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

        await fetchEmojiJSON();
        _converse.emojis.shortnames_regex = new RegExp("<object[^>]*>.*?<\/object>|<span[^>]*>.*?<\/span>|<(?:object|embed|svg|img|div|span|p|a)[^>]*>|("+getShortNames()+")", "gi");
        _converse.emojis.by_category = getEmojisByCategory();
        _converse.emojis.categories = ["people", "activity", "travel", "objects", "nature", "food", "symbols", "flags"];
        _converse.emojis.toned = getTonedEmojis();
        /**
         * Triggered once the JSON file representing emoji data has been
         * fetched and its save to start calling emoji utility methods.
         * @event _converse#emojisInitialized
         */
        _converse.api.trigger('emojisInitialized');
    }
});
