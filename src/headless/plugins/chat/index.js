/**
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import ChatBox from './model.js';
import Message from './message.js';
import Messages from './messages.js';
import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import chat_api from './api.js';
import { PRIVATE_CHAT_TYPE } from '../../shared/constants.js';
import {
    autoJoinChats,
    enableCarbons,
    handleMessageStanza,
    onClearSession,
    routeToChat,
    registerMessageHandlers,
} from './utils.js';

converse.plugins.add('converse-chat', {
    dependencies: ['converse-chatboxes', 'converse-disco'],

    initialize () {
        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            'allow_message_corrections': 'all',
            'allow_message_retraction': 'all',
            'allow_message_styling': true,
            'auto_join_private_chats': [],
            'clear_messages_on_reconnection': false,
            'filter_by_resource': false,
            'prune_messages_above': undefined,
            'pruning_behavior': 'unscrolled',
            'send_chat_markers': ['received', 'displayed', 'acknowledged'],
            'send_chat_state_notifications': true,
        });

        Object.assign(_converse, { ChatBox, Message, Messages, handleMessageStanza });
        Object.assign(api, chat_api);

        api.chatboxes.registry.add(PRIVATE_CHAT_TYPE, ChatBox);

        routeToChat();
        addEventListener('hashchange', routeToChat);

        api.listen.on('chatBoxesFetched', autoJoinChats);
        api.listen.on('presencesInitialized', registerMessageHandlers);
        api.listen.on('clearSession', onClearSession);

        api.listen.on('connected', () => enableCarbons());
        api.listen.on('reconnected', () => enableCarbons());
    },
});
