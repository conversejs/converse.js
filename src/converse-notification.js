// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2013-2019, JC Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

import converse from "@converse/headless/converse-core";

const { Strophe, _, sizzle } = converse.env,
      u = converse.env.utils;


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
            show_chatstate_notifications: false,
            chatstate_notification_blacklist: [],
            // ^ a list of JIDs to ignore concerning chat state notifications
            play_sounds: true,
            sounds_path: 'sounds/',
            notification_icon: 'logo/conversejs-filled.svg',
            notification_delay: 5000
        });

        _converse.isOnlyChatStateNotification = (msg) =>
            // See XEP-0085 Chat State Notification
            _.isNull(msg.querySelector('body')) && (
                    _.isNull(msg.querySelector(_converse.ACTIVE)) ||
                    _.isNull(msg.querySelector(_converse.COMPOSING)) ||
                    _.isNull(msg.querySelector(_converse.INACTIVE)) ||
                    _.isNull(msg.querySelector(_converse.PAUSED)) ||
                    _.isNull(msg.querySelector(_converse.GONE))
                )
        ;

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
            if (_.isNull(body)) {
                return false;
            }
            const mentioned = (new RegExp(`\\b${room.get('nick')}\\b`)).test(body.textContent);
            notify_all = notify_all === true ||
                (_.isArray(notify_all) && _.includes(notify_all, room_jid));
            if (sender === room.get('nick') || (!notify_all && !mentioned)) {
                return false;
            }
            return true;
        };

        _converse.isMessageToHiddenChat = function (message) {
            if (_converse.isUniView()) {
                const jid = Strophe.getBareJidFromJid(message.getAttribute('from')),
                      view = _converse.chatboxviews.get(jid);

                if (!_.isNil(view)) {
                    return view.model.get('hidden') || _converse.windowState === 'hidden' || !u.isVisible(view.el);
                }
                return true;
            }
            return _converse.windowState === 'hidden';
        }

        _converse.shouldNotifyOfMessage = function (message) {
            const forwarded = message.querySelector('forwarded');
            if (!_.isNull(forwarded)) {
                return false;
            } else if (message.getAttribute('type') === 'groupchat') {
                return _converse.shouldNotifyOfGroupMessage(message);
            } else if (u.isHeadlineMessage(_converse, message)) {
                // We want to show notifications for headline messages.
                return _converse.isMessageToHiddenChat(message);
            }
            const is_me = Strophe.getBareJidFromJid(
                    message.getAttribute('from')) === _converse.bare_jid;
            return !_converse.isOnlyChatStateNotification(message) &&
                !is_me &&
                (_converse.show_desktop_notifications === 'all' || _converse.isMessageToHiddenChat(message));
        };


        _converse.playSoundNotification = function () {
            /* Plays a sound to notify that a new message was recieved.
             */
            // XXX Eventually this can be refactored to use Notification's sound
            // feature, but no browser currently supports it.
            // https://developer.mozilla.org/en-US/docs/Web/API/notification/sound
            if (_converse.play_sounds && !_.isUndefined(window.Audio)) {
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

        _converse.showMessageNotification = function (message) {
            /* Shows an HTML5 Notification to indicate that a new chat
             * message was received.
             */
            if (!_converse.areDesktopNotificationsEnabled()) {
                return;
            }
            let title, roster_item;
            const full_from_jid = message.getAttribute('from'),
                  from_jid = Strophe.getBareJidFromJid(full_from_jid);
            if (message.getAttribute('type') === 'headline') {
                if (!_.includes(from_jid, '@') || _converse.allow_non_roster_messaging) {
                    title = __("Notification from %1$s", from_jid);
                } else {
                    return;
                }
            } else if (!_.includes(from_jid, '@')) {
                // workaround for Prosody which doesn't give type "headline"
                title = __("Notification from %1$s", from_jid);
            } else if (message.getAttribute('type') === 'groupchat') {
                title = __("%1$s says", Strophe.getResourceFromJid(full_from_jid));
            } else {
                if (_.isUndefined(_converse.roster)) {
                    _converse.log(
                        "Could not send notification, because roster is undefined",
                        Strophe.LogLevel.ERROR);
                    return;
                }
                roster_item = _converse.roster.get(from_jid);
                if (!_.isUndefined(roster_item)) {
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
                         _.get(message.querySelector('body'), 'textContent');
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
            if (_.includes(_converse.chatstate_notification_blacklist, contact.jid)) {
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
            if (_converse.areDesktopNotificationsEnabled() && _converse.show_chatstate_notifications) {
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
            _converse.api.emit('messageNotification', message);
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
            if (_converse.supports_html5_notification &&
                ! _.includes(['denied', 'granted'], Notification.permission)) {
                // Ask user to enable HTML5 notifications
                Notification.requestPermission();
            }
        };

        _converse.on('pluginsInitialized', function () {
            // We only register event handlers after all plugins are
            // registered, because other plugins might override some of our
            // handlers.
            _converse.on('contactRequest',  _converse.handleContactRequestNotification);
            _converse.on('contactPresenceChanged',  _converse.handleChatStateNotification);
            _converse.on('message',  _converse.handleMessageNotification);
            _converse.on('feedback', _converse.handleFeedback);
            _converse.on('connected', _converse.requestPermission);
        });
    }
});

