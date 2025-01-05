/**
 * @module converse-emoji
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { getOpenPromise } from '@converse/openpromise';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import EmojiPicker from './picker.js';
import emojis from './api.js';
import { isOnlyEmojis } from './utils.js';

converse.emojis = {
    initialized: false,
    initialized_promise: getOpenPromise(),
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
                'smileys': ':grinning:',
                'people': ':thumbsup:',
                'activity': ':soccer:',
                'travel': ':motorcycle:',
                'objects': ':bomb:',
                'nature': ':rainbow:',
                'food': ':hotdog:',
                'symbols': ':musical_note:',
                'flags': ':flag_ac:',
                'custom': null,
            },
            // We use the triple-underscore method which doesn't actually
            // translate but does signify to gettext that these strings should
            // go into the POT file. The translation then happens in the
            // template. We do this so that users can pass in their own
            // strings via converse.initialize, which is before __ is
            // available.
            'emoji_category_labels': {
                'smileys': ___('Smileys and emotions'),
                'people': ___('People'),
                'activity': ___('Activities'),
                'travel': ___('Travel'),
                'objects': ___('Objects'),
                'nature': ___('Animals and nature'),
                'food': ___('Food and drink'),
                'symbols': ___('Symbols'),
                'flags': ___('Flags'),
                'custom': ___('Stickers'),
            },
        });

        const exports = { EmojiPicker };
        Object.assign(_converse, exports); // XXX: DEPRECATED
        Object.assign(_converse.exports, exports);
        Object.assign(api, emojis);

        api.listen.on('getOutgoingMessageAttributes', async (_chat, attrs) => {
            await api.emojis.initialize();
            const { original_text: text } = attrs;
            return {
                ...attrs,
                is_only_emojis: text ? isOnlyEmojis(text) : false,
            };
        });

        async function parseMessage (_stanza, attrs) {
            await api.emojis.initialize();
            return {
                ...attrs,
                is_only_emojis: attrs.body ? isOnlyEmojis(attrs.body) : false
            }
        }

        api.listen.on('parseMUCMessage', parseMessage);
        api.listen.on('parseMessage', parseMessage);
    },
});
