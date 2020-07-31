/**
 * @module converse-chatview
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { __ } from '@converse/headless/i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";

// Plugins
import "converse-chatboxviews";
import "converse-modal";

// Components
import "./components/chat_content.js";
import "./components/help_messages.js";
import "./components/toolbar.js";

// Views
import ChatBoxView from './views/ChatBoxView';
import UserDetailsModal from './views/UserDetailsModal';

import chatviews_api from './api';
import settings from './settings.js';


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
    dependencies: [
        "converse-chatboxviews",
        "converse-chat",
        "converse-disco",
        "converse-modal"
    ],

    initialize () {
        api.settings.extend(settings);

        // _converse
        _converse.ChatBoxView = ChatBoxView;
        _converse.UserDetailsModal = UserDetailsModal;

        // Evemt Handlers
        function onWindowStateChanged (data) {
            if (_converse.chatboxviews) {
                _converse.chatboxviews.forEach(view => {
                    if (view.model.get('id') !== 'controlbox') {
                        view.onWindowStateChanged(data.state);
                    }
                });
            }
        }
        function onChatBoxViewInitialized () {
            const views = _converse.chatboxviews;
            _converse.chatboxes.on('add', async item => {
                if (!views.get(item.get('id')) && item.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                    await item.initialized;
                    views.add(item.get('id'), new _converse.ChatBoxView({model: item}));
                }
            });
        }
        api.listen.on('windowStateChanged', onWindowStateChanged);
        api.listen.on('chatBoxViewsInitialized', onChatBoxViewInitialized);
        api.listen.on('connected', () => api.disco.own.features.add(Strophe.NS.SPOILER));

        // API
        /**
         * The "chatview" namespace groups methods pertaining to views
         * for one-on-one chats.
         *
         * @namespace _converse.api.chatviews
         * @memberOf _converse.api
         */
        Object.assign(api, chatviews_api);
    }
});
