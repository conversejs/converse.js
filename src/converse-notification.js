// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2013-2019, JC Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-notification
 */
import converse from "@converse/headless/converse-core";
import { get } from "lodash";

const { Strophe, sizzle } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-notification', {

    dependencies: ["converse-chatboxes"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;
        const { __ } = _converse;

        _converse.supports_html5_notification = "Notification" in window;

        _converse.api.settings.update({
            notify_all_room_messages: false,
            show_desktop_notifications: true,
            show_chat_state_notifications: false,
            chatstate_notification_blacklist: [],
            // ^ a list of JIDs to ignore concerning chat state notifications
            play_sounds: true,
            sounds_path: 'sounds/',
            notification_icon: 'logo/conversejs-filled.svg',
            notification_delay: 5000
        });

        _converse.shouldNotifyOfGroupMessage = function (message) {
            /* Is this a group message worthy of notification?
             */
            let notify_all = _converse.notify_all_room_messages;
            const jid = message.getAttribute('from'),
                resource = Strophe.getResourceFromJid(jid),
                room_jid = Strophe.getBareJidFromJid(jid),
                sender = resource && Strophe.unescapeNode(resource) || '';
            if (sender === '' || message.querySelectorAll('delay').length > 0) {
                return false;
            }
            const room = _converse.chatboxes.get(room_jid);
            const body = message.querySelector('body');
            if (body === null) {
                return false;
            }
            const mentioned = (new RegExp(`\\b${room.get('nick')}\\b`)).test(body.textContent);
            notify_all = notify_all === true ||
                (Array.isArray(notify_all) && notify_all.includes(room_jid));
            if (sender === room.get('nick') || (!notify_all && !mentioned)) {
                return false;
            }
            return true;
        };

        _converse.isMessageToHiddenChat = function (message) {
            if (_converse.isUniView()) {
                const jid = Strophe.getBareJidFromJid(message.getAttribute('from'));
                const view = _converse.chatboxviews.get(jid);
                if (view) {
                    return view.model.get('hidden') || _converse.windowState === 'hidden' || !u.isVisible(view.el);
                }
                return true;
            }
            return _converse.windowState === 'hidden';
        }

        _converse.shouldNotifyOfMessage = function (message) {
            const forwarded = message.querySelector('forwarded');
            if (forwarded !== null) {
                return false;
            } else if (message.getAttribute('type') === 'groupchat') {
                return _converse.shouldNotifyOfGroupMessage(message);
            } else if (u.isHeadlineMessage(_converse, message)) {
                // We want to show notifications for headline messages.
                return _converse.isMessageToHiddenChat(message);
            }
            const is_me = Strophe.getBareJidFromJid(message.getAttribute('from')) === _converse.bare_jid;
            return !u.isOnlyChatStateNotification(message) &&
                !u.isOnlyMessageDeliveryReceipt(message) &&
                !is_me &&
                (_converse.show_desktop_notifications === 'all' || _converse.isMessageToHiddenChat(message));
        };


        /**
         * Plays a notification sound
         * @private
         * @method _converse#playSoundNotification
         */
        _converse.playSoundNotification = function () {
            if (_converse.play_sounds && window.Audio !== undefined) {
                const audioOgg = new Audio(_converse.sounds_path+"msg_received.ogg");
                const canPlayOgg = audioOgg.canPlayType('audio/ogg');
                if (canPlayOgg === 'probably') {
                    return audioOgg.play();
                }
                const audioMp3 = new Audio(_converse.sounds_path+"msg_received.mp3");
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
            return _converse.supports_html5_notification &&
                _converse.show_desktop_notifications &&
                Notification.permission === "granted";
        };

        /**
         * Shows an HTML5 Notification with the passed in message
         * @private
         * @method _converse#showMessageNotification
         * @param { String } message
         */
        _converse.showMessageNotification = function (message) {
            if (!_converse.areDesktopNotificationsEnabled()) {
                return;
            }
            let title, roster_item;
            const full_from_jid = message.getAttribute('from'),
                  from_jid = Strophe.getBareJidFromJid(full_from_jid);
            if (message.getAttribute('type') === 'headline') {
                if (!from_jid.includes('@') || _converse.allow_non_roster_messaging) {
                    title = __("Notification from %1$s", from_jid);
                } else {
                    return;
                }
            } else if (!from_jid.includes('@')) {
                // workaround for Prosody which doesn't give type "headline"
                title = __("Notification from %1$s", from_jid);
            } else if (message.getAttribute('type') === 'groupchat') {
                title = __("%1$s says", Strophe.getResourceFromJid(full_from_jid));
            } else {
                if (_converse.roster === undefined) {
                    _converse.log(
                        "Could not send notification, because roster is undefined",
                        Strophe.LogLevel.ERROR);
                    return;
                }
                roster_item = _converse.roster.get(from_jid);
                if (roster_item !== undefined) {
                    title = __("%1$s says", roster_item.getDisplayName());
                } else {
                    if (_converse.allow_non_roster_messaging) {
                        title = __("%1$s says", from_jid);
                    } else {
                        return;
                    }
                }
            }
            // TODO: we should suppress notifications if we cannot decrypt
            // the message...
            const body = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, message).length ?
                         __('OMEMO Message received') :
                         get(message.querySelector('body'), 'textContent');
            if (!body) {
                return;
            }
            const n = new Notification(title, {
                'body': body,
                'lang': _converse.locale,
                'icon': _converse.notification_icon,
                'requireInteraction': !_converse.notification_delay
            });
            if (_converse.notification_delay) {
                setTimeout(n.close.bind(n), _converse.notification_delay);
            }
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
            if (_converse.areDesktopNotificationsEnabled() && _converse.show_chat_state_notifications) {
                _converse.showChatStateNotification(contact);
            }
        };

        _converse.handleMessageNotification = function (data) {
            /* Event handler for the on('message') event. Will call methods
             * to play sounds and show HTML5 notifications.
             */
            const message = data.stanza;
            if (!_converse.shouldNotifyOfMessage(message)) {
                return false;
            }
            /**
             * Triggered when a notification (sound or HTML5 notification) for a new
             * message has will be made.
             * @event _converse#messageNotification
             * @type { XMLElement }
             * @example _converse.api.listen.on('messageNotification', stanza => { ... });
             */
            _converse.api.trigger('messageNotification', message);
            _converse.playSoundNotification();
            _converse.showMessageNotification(message);
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
            if (_converse.supports_html5_notification && !['denied', 'granted'].includes(Notification.permission)) {
                // Ask user to enable HTML5 notifications
                Notification.requestPermission();
            }
        };

        _converse.api.listen.on('pluginsInitialized', function () {
            // We only register event handlers after all plugins are
            // registered, because other plugins might override some of our
            // handlers.
            _converse.api.listen.on('contactRequest',  _converse.handleContactRequestNotification);
            _converse.api.listen.on('contactPresenceChanged',  _converse.handleChatStateNotification);
            _converse.api.listen.on('message',  _converse.handleMessageNotification);
            _converse.api.listen.on('feedback', _converse.handleFeedback);
            _converse.api.listen.on('connected', _converse.requestPermission);
        });
    }
});
