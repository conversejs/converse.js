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
import { parseMessage, registerPEPPushHandler, updatePopularEmojis } from './handlers.js';
import PopularEmojis from './popular-emojis.js';

const { Strophe } = converse.env;

Strophe.addNamespace('REACTIONS_POPULAR', 'urn:xmpp:reactions:popular:0');

converse.emojis = {
    initialized: false,
    initialized_promise: getOpenPromise(),
};

converse.plugins.add('converse-emoji', {
    initialize() {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { ___ } = _converse;

        api.settings.extend({
            emoji_image_path: 'https://twemoji.maxcdn.com/v/12.1.6/',
            emoji_categories: {
                popular: ':star:',
                smileys: ':grinning:',
                people: ':thumbsup:',
                activity: ':soccer:',
                travel: ':motorcycle:',
                objects: ':bomb:',
                nature: ':rainbow:',
                food: ':hotdog:',
                symbols: ':musical_note:',
                flags: ':flag_ac:',
                custom: null,
            },
            popular_emojis: [':thumbsup:', ':heart:', ':laughing:', ':joy:', ':tada:'],
            // We use the triple-underscore method which doesn't actually
            // translate but does signify to gettext that these strings should
            // go into the POT file. The translation then happens in the
            // template. We do this so that users can pass in their own
            // strings via converse.initialize, which is before __ is
            // available.
            emoji_category_labels: {
                popular: ___('Frequently used'),
                smileys: ___('Smileys and emotions'),
                people: ___('People'),
                activity: ___('Activities'),
                travel: ___('Travel'),
                objects: ___('Objects'),
                nature: ___('Animals and nature'),
                food: ___('Food and drink'),
                symbols: ___('Symbols'),
                flags: ___('Flags'),
                custom: ___('Stickers'),
            },
        });

        const exports = { EmojiPicker };
        Object.assign(_converse, exports); // XXX: DEPRECATED
        Object.assign(_converse.exports, exports);
        Object.assign(api, emojis);

        api.listen.on('connected', () => {
            registerPEPPushHandler();
            if (_converse.state.popular_emojis) return;

            const popular_emojis = new PopularEmojis();
            Object.assign(_converse.state, { popular_emojis });
        });

        api.listen.on('clearSession', () => {
            _converse.state.popular_emojis?.debouncedPublish.flush();
            delete _converse.state.popular_emojis;
        });

        api.listen.on('getOutgoingMessageAttributes', async (_chat, attrs) => parseMessage(attrs, attrs.original_text));
        api.listen.on('parseMUCMessage', (_chat, attrs) => parseMessage(attrs, attrs.body));
        api.listen.on('parseMessage', (_chat, attrs) => parseMessage(attrs, attrs.body));
        api.listen.on('sendMessage', async ({ message }) => updatePopularEmojis(message));
    },
});
