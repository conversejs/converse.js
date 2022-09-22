/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import '../chatboxviews/index.js';
import 'shared/chat/chat-content.js';
import 'shared/chat/help-messages.js';
import 'shared/chat/toolbar.js';
import ChatView from './chat.js';
import { _converse, api, converse } from '@converse/headless/core';
import { clearHistory } from './utils.js';

import './styles/index.scss';

const { Strophe } = converse.env;


converse.plugins.add('converse-chatview', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ['converse-chatboxviews', 'converse-chat', 'converse-disco', 'converse-modal'],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.extend({
            'allowed_audio_domains': null,
            'allowed_image_domains': null,
            'allowed_video_domains': null,
            'auto_focus': true,
            'debounced_content_rendering': true,
            'filter_url_query_params': null,
            'image_urls_regex': null,
            'message_limit': 0,
            'muc_hats': ['xep317'],
            'render_media': true,
            'show_message_avatar': true,
            'show_retraction_warning': true,
            'show_send_button': true,
            'show_toolbar': true,
            'time_format': 'HH:mm',
            'use_system_emojis': true,
            'visible_toolbar_buttons': {
                'call': false,
                'clear': true,
                'emoji': true,
                'spoiler': true
            }
        });

        _converse.ChatBoxView = ChatView;

        api.listen.on('connected', () => api.disco.own.features.add(Strophe.NS.SPOILER));
        api.listen.on('chatBoxClosed', (model) => clearHistory(model.get('jid')));
    }
});
