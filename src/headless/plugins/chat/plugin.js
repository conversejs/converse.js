import ChatBox from './model.js';
import Message from './message.js';
import Messages from './messages.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import chatboxes_api from '../chatboxes/api.js';
import chat_api from './api.js';
import { PRIVATE_CHAT_TYPE } from '../../shared/constants.js';
import {
    autoJoinChats,
    enableCarbons,
    handleMessageStanza,
    routeToChat,
    registerMessageHandlers,
} from './utils.js';

const { Strophe } = converse.env;


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

        const exports = { ChatBox, Message, Messages, handleMessageStanza };
        Object.assign(_converse, exports); // TODO: DEPRECATED
        Object.assign(_converse.exports, exports);

        Object.assign(api, chat_api);

        chatboxes_api.registry.add(PRIVATE_CHAT_TYPE, ChatBox);

        routeToChat();
        addEventListener('hashchange', routeToChat);

        api.listen.on('chatBoxesFetched', autoJoinChats);
        api.listen.on('presencesInitialized', registerMessageHandlers);

        api.listen.on('connected', () => enableCarbons());
        api.listen.on('reconnected', () => enableCarbons());

        // Advertise XEP-0461 Message Replies support
        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(Strophe.NS.REPLY);
        });
    },
});
