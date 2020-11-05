/**
 * @module converse-notification
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import Favico from 'favico.js-slevomat';
import log from "@converse/headless/log";
import { __ } from './i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";

const { Strophe } = converse.env;
const u = converse.env.utils;

const supports_html5_notification = "Notification" in window;

converse.env.Favico = Favico;
let favicon;

function updateUnreadFavicon () {
    if (api.settings.get('update_title')) {
        favicon = favicon ?? new converse.env.Favico({type: 'circle', animation: 'pop'});
        const chats = _converse.chatboxes.models;
        const num_unread = chats.reduce((acc, chat) => (acc + (chat.get('num_unread') || 0)), 0);
        favicon.badge(num_unread);
    }
}


converse.plugins.add('converse-notification', {

    dependencies: ["converse-chatboxes"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */

        api.settings.extend({
            update_title: true,
            notify_all_room_messages: false,
            show_desktop_notifications: true,
            show_chat_state_notifications: false,
            chatstate_notification_blacklist: [],
            // ^ a list of JIDs to ignore concerning chat state notifications
            play_sounds: true,
            sounds_path: api.settings.get("assets_path")+'/sounds/',
            notification_icon: 'logo/conversejs-filled.svg',
            notification_delay: 5000,
            notify_nicknames_without_references: false
        });

        /**
         * Is this a group message for which we should notify the user?
         * @private
         * @method _converse#shouldNotifyOfGroupMessage
         * @param { MUCMessageAttributes } attrs
         */
        _converse.shouldNotifyOfGroupMessage = function (attrs) {
            if (!attrs?.body) {
                return false;
            }
            const jid = attrs.from;
            const room_jid = attrs.from_muc;
            const notify_all = api.settings.get('notify_all_room_messages');
            const room = _converse.chatboxes.get(room_jid);
            const resource = Strophe.getResourceFromJid(jid);
            const sender = resource && Strophe.unescapeNode(resource) || '';
            let is_mentioned = false;
            const nick = room.get('nick');

            if (api.settings.get('notify_nicknames_without_references')) {
                is_mentioned = (new RegExp(`\\b${nick}\\b`)).test(attrs.body);
            }

            const is_referenced = attrs.references.map(r => r.value).includes(nick);
            const is_not_mine = sender !== nick;
            const should_notify_user = notify_all === true
                || (Array.isArray(notify_all) && notify_all.includes(room_jid))
                || is_referenced
                || is_mentioned;
            return is_not_mine && !!should_notify_user;
        };

        /**
         * Given parsed attributes for a message stanza, get the related
         * chatbox and check whether it's hidden.
         * @private
         * @method _converse#isMessageToHiddenChat
         * @param { MUCMessageAttributes } attrs
         */
        _converse.isMessageToHiddenChat = function (attrs) {
            return _converse.chatboxes.get(attrs.from)?.isHidden() ?? false;
        };

        /**
         * @private
         * @method _converse#shouldNotifyOfMessage
         * @param { MessageData|MUCMessageData } data
         */
        _converse.shouldNotifyOfMessage = function (data) {
            const { attrs, stanza } = data;
            if (!attrs || stanza.querySelector('forwarded') !== null) {
                return false;
            }
            if (attrs['type'] === 'groupchat') {
                return _converse.shouldNotifyOfGroupMessage(attrs);
            } else if (attrs.is_headline) {
                // We want to show notifications for headline messages.
                return _converse.isMessageToHiddenChat(attrs);
            }
            const is_me = Strophe.getBareJidFromJid(attrs.from) === _converse.bare_jid;
            return !u.isOnlyChatStateNotification(stanza) &&
                !u.isOnlyMessageDeliveryReceipt(stanza) &&
                !is_me &&
                (api.settings.get('show_desktop_notifications') === 'all' || _converse.isMessageToHiddenChat(attrs));
        };


        /**
         * Plays a notification sound
         * @private
         * @method _converse#playSoundNotification
         */
        _converse.playSoundNotification = function () {
            if (api.settings.get('play_sounds') && window.Audio !== undefined) {
                const audioOgg = new Audio(api.settings.get('sounds_path')+"msg_received.ogg");
                const canPlayOgg = audioOgg.canPlayType('audio/ogg');
                if (canPlayOgg === 'probably') {
                    return audioOgg.play();
                }
                const audioMp3 = new Audio(api.settings.get('sounds_path')+"msg_received.mp3");
                const canPlayMp3 = audioMp3.canPlayType('audio/mp3');
                if (canPlayMp3 === 'probably') {
                    audioMp3.play();
                } else if (canPlayOgg === 'maybe') {
                    audioOgg.play();
                } else if (canPlayMp3 === 'maybe') {
                    audioMp3.play();
                }
            }
        };

        _converse.areDesktopNotificationsEnabled = function () {
            return supports_html5_notification &&
                api.settings.get('show_desktop_notifications') &&
                Notification.permission === "granted";
        };

        /**
         * Shows an HTML5 Notification with the passed in message
         * @private
         * @method _converse#showMessageNotification
         * @param { MessageData|MUCMessageData } data
         */
        _converse.showMessageNotification = function (data) {
            const { attrs } = data;
            if (attrs.is_error) {
                return;
            }

            if (!_converse.areDesktopNotificationsEnabled()) {
                return;
            }
            let title, roster_item;
            const full_from_jid = attrs.from,
                  from_jid = Strophe.getBareJidFromJid(full_from_jid);
            if (attrs.type === 'headline') {
                if (!from_jid.includes('@') || api.settings.get("allow_non_roster_messaging")) {
                    title = __("Notification from %1$s", from_jid);
                } else {
                    return;
                }
            } else if (!from_jid.includes('@')) {
                // workaround for Prosody which doesn't give type "headline"
                title = __("Notification from %1$s", from_jid);
            } else if (attrs.type === 'groupchat') {
                title = __("%1$s says", Strophe.getResourceFromJid(full_from_jid));
            } else {
                if (_converse.roster === undefined) {
                    log.error("Could not send notification, because roster is undefined");
                    return;
                }
                roster_item = _converse.roster.get(from_jid);
                if (roster_item !== undefined) {
                    title = __("%1$s says", roster_item.getDisplayName());
                } else {
                    if (api.settings.get("allow_non_roster_messaging")) {
                        title = __("%1$s says", from_jid);
                    } else {
                        return;
                    }
                }
            }

            const body = attrs.is_encrypted ? __('Encrypted message received') : attrs.body;
            if (!body) {
                return;
            }
            const n = new Notification(title, {
                'body': body,
                'lang': _converse.locale,
                'icon': api.settings.get('notification_icon'),
                'requireInteraction': !_converse.notification_delay
            });
            if (api.settings.get('notification_delay')) {
                setTimeout(n.close.bind(n), api.settings.get('notification_delay'));
            }
            n.onclick = function (event) {
                event.preventDefault();
                window.focus();
                const chat = _converse.chatboxes.get(from_jid);
                chat.maybeShow(true);
            }
            n.onclick.bind(_converse);
        };

        _converse.showChatStateNotification = function (contact) {
            /* Creates an HTML5 Notification to inform of a change in a
             * contact's chat state.
             */
            if (_converse.chatstate_notification_blacklist.includes(contact.jid)) {
                // Don't notify if the user is being ignored.
                return;
            }
            const chat_state = contact.chat_status;
            let message = null;
            if (chat_state === 'offline') {
                message = __('has gone offline');
            } else if (chat_state === 'away') {
                message = __('has gone away');
            } else if ((chat_state === 'dnd')) {
                message = __('is busy');
            } else if (chat_state === 'online') {
                message = __('has come online');
            }
            if (message === null) {
                return;
            }
            const n = new Notification(contact.getDisplayName(), {
                    body: message,
                    lang: _converse.locale,
                    icon: _converse.notification_icon
                });
            setTimeout(n.close.bind(n), 5000);
        };

        _converse.showContactRequestNotification = function (contact) {
            const n = new Notification(contact.getDisplayName(), {
                    body: __('wants to be your contact'),
                    lang: _converse.locale,
                    icon: _converse.notification_icon
                });
            setTimeout(n.close.bind(n), 5000);
        };

        _converse.showFeedbackNotification = function (data) {
            if (data.klass === 'error' || data.klass === 'warn') {
                const n = new Notification(data.subject, {
                        body: data.message,
                        lang: _converse.locale,
                        icon: _converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            }
        };

        _converse.handleChatStateNotification = function (contact) {
            /* Event handler for on('contactPresenceChanged').
             * Will show an HTML5 notification to indicate that the chat
             * status has changed.
             */
            if (_converse.areDesktopNotificationsEnabled() && api.settings.get('show_chat_state_notifications')) {
                _converse.showChatStateNotification(contact);
            }
        };

        _converse.handleMessageNotification = function (data) {
            /* Event handler for the on('message') event. Will call methods
             * to play sounds and show HTML5 notifications.
             */
            if (!_converse.shouldNotifyOfMessage(data)) {
                return false;
            }
            /**
             * Triggered when a notification (sound or HTML5 notification) for a new
             * message has will be made.
             * @event _converse#messageNotification
             * @type { MessageData|MUCMessageData}
             * @example _converse.api.listen.on('messageNotification', stanza => { ... });
             */
            api.trigger('messageNotification', data);
            _converse.playSoundNotification();
            _converse.showMessageNotification(data);
        };

        _converse.handleContactRequestNotification = function (contact) {
            if (_converse.areDesktopNotificationsEnabled(true)) {
                _converse.showContactRequestNotification(contact);
            }
        };

        _converse.handleFeedback = function (data) {
            if (_converse.areDesktopNotificationsEnabled(true)) {
                _converse.showFeedbackNotification(data);
            }
        };

        _converse.requestPermission = function () {
            if (supports_html5_notification && !['denied', 'granted'].includes(Notification.permission)) {
                // Ask user to enable HTML5 notifications
                Notification.requestPermission();
            }
        };

        /************************ BEGIN Event Handlers ************************/

        api.listen.on('clearSession', () => (favicon = null)); // Needed for tests

        api.waitUntil('chatBoxesInitialized').then(
            () => _converse.chatboxes.on('change:num_unread', updateUnreadFavicon));

        api.listen.on('pluginsInitialized', function () {
            // We only register event handlers after all plugins are
            // registered, because other plugins might override some of our
            // handlers.
            api.listen.on('contactRequest',  _converse.handleContactRequestNotification);
            api.listen.on('contactPresenceChanged',  _converse.handleChatStateNotification);
            api.listen.on('message',  _converse.handleMessageNotification);
            api.listen.on('feedback', _converse.handleFeedback);
            api.listen.on('connected', _converse.requestPermission);
        });
    }
});
