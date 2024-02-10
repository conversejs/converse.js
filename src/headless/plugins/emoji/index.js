/**
 * @module converse-emoji
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './utils.js';
import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import { Model } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';


converse.emojis = {
    'initialized': false,
    'initialized_promise': getOpenPromise()
};


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
         * @namespace _converse.EmojiPicker
         * @memberOf _converse
         */
        class EmojiPicker extends Model {
            defaults () { // eslint-disable-line class-methods-use-this
                return {
                    'current_category': 'smileys',
                    'current_skintone': '',
                    'scroll_position': 0
                }
            }
        }

        const exports = { EmojiPicker };
        Object.assign(_converse, exports); // XXX: DEPRECATED
        Object.assign(_converse.exports, exports);

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
                        const module = await import(/*webpackChunkName: "emojis" */ './emoji.json');
                        const json = converse.emojis.json = module.default;
                        converse.emojis.by_sn = Object.keys(json).reduce((result, cat) => Object.assign(result, json[cat]), {});
                        converse.emojis.list = Object.values(converse.emojis.by_sn);
                        converse.emojis.list.sort((a, b) => a.sn < b.sn ? -1 : (a.sn > b.sn ? 1 : 0));
                        converse.emojis.shortnames = converse.emojis.list.map(m => m.sn);
                        const getShortNames = () => converse.emojis.shortnames.map(s => s.replace(/[+]/g, "\\$&")).join('|');
                        converse.emojis.shortnames_regex = new RegExp(getShortNames(), "gi");
                        converse.emojis.initialized_promise.resolve();
                    }
                    return converse.emojis.initialized_promise;
                }
            }
        });
    }
});
