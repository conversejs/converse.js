/**
 * @module converse-notification
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse } from '@converse/headless/core';
import {
    clearFavicon,
    handleChatStateNotification,
    handleContactRequestNotification,
    handleFeedback,
    handleMessageNotification,
    requestPermission,
    updateUnreadFavicon
} from './utils.js';

converse.plugins.add('converse-notification', {
    dependencies: ['converse-chatboxes'],

    initialize () {
        api.settings.extend({
            // ^ a list of JIDs to ignore concerning chat state notifications
            chatstate_notification_blacklist: [],
            notification_delay: 5000,
            notification_icon: 'logo/conversejs-filled.svg',
            notify_all_room_messages: false,
            notify_nicknames_without_references: false,
            play_sounds: true,
            show_chat_state_notifications: false,
            show_desktop_notifications: true,
            show_tab_notifications: true,
            sounds_path: api.settings.get('assets_path') + '/sounds/'
        });

        /************************ Event Handlers ************************/
        api.listen.on('clearSession', clearFavicon); // Needed for tests

        api.waitUntil('chatBoxesInitialized').then(() =>
            _converse.chatboxes.on('change:num_unread', updateUnreadFavicon)
        );

        api.listen.on('pluginsInitialized', function () {
            // We only register event handlers after all plugins are
            // registered, because other plugins might override some of our
            // handlers.
            api.listen.on('contactRequest', handleContactRequestNotification);
            api.listen.on('contactPresenceChanged', handleChatStateNotification);
            api.listen.on('message', handleMessageNotification);
            api.listen.on('feedback', handleFeedback);
            api.listen.on('connected', requestPermission);
        });
    }
});
