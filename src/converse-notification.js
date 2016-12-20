// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define("converse-notification", ["converse-api"], factory);
}(this, function (converse) {
    "use strict";
    var $ = converse.env.jQuery,
        utils = converse.env.utils,
        Strophe = converse.env.Strophe,
        _ = converse.env._;

    converse.plugins.add('converse-notification', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse;

            // For translations
            var __ = _converse.__;
            var ___ = _converse.___;

            _converse.supports_html5_notification = "Notification" in window;

            this.updateSettings({
                notify_all_room_messages: false,
                show_desktop_notifications: true,
                chatstate_notification_blacklist: [],
                // ^ a list of JIDs to ignore concerning chat state notifications
                play_sounds: false,
                sounds_path: '/sounds/',
                notification_icon: '/logo/conversejs128.png'
            });

            _converse.isOnlyChatStateNotification = function ($msg) {
                // See XEP-0085 Chat State Notification
                return (
                    $msg.find('body').length === 0 && (
                        $msg.find(_converse.ACTIVE).length !== 0 ||
                        $msg.find(_converse.COMPOSING).length !== 0 ||
                        $msg.find(_converse.INACTIVE).length !== 0 ||
                        $msg.find(_converse.PAUSED).length !== 0 ||
                        $msg.find(_converse.GONE).length !== 0
                    )
                );
            };

            _converse.shouldNotifyOfGroupMessage = function ($message) {
                /* Is this a group message worthy of notification?
                 */
                var notify_all = _converse.notify_all_room_messages,
                    jid = $message.attr('from'),
                    resource = Strophe.getResourceFromJid(jid),
                    room_jid = Strophe.getBareJidFromJid(jid),
                    sender = resource && Strophe.unescapeNode(resource) || '';
                if (sender === '' || $message.find('delay').length > 0) {
                    return false;
                }
                var room = _converse.chatboxes.get(room_jid);
                var $body = $message.children('body');
                if (!$body.length) {
                    return false;
                }
                var mentioned = (new RegExp("\\b"+room.get('nick')+"\\b")).test($body.text());
                notify_all = notify_all === true || (_.isArray(notify_all) && _.contains(notify_all, room_jid));
                if (sender === room.get('nick') || (!notify_all && !mentioned)) {
                    return false;
                }
                return true;
            };

            _converse.shouldNotifyOfMessage = function (message) {
                /* Is this a message worthy of notification?
                 */
                if (utils.isOTRMessage(message)) {
                    return false;
                }
                var $message = $(message),
                    $forwarded = $message.find('forwarded');
                if ($forwarded.length) {
                    return false;
                } else if ($message.attr('type') === 'groupchat') {
                    return _converse.shouldNotifyOfGroupMessage($message);
                } else if (utils.isHeadlineMessage(message)) {
                    // We want to show notifications for headline messages.
                    return true;
                }
                var is_me = Strophe.getBareJidFromJid($message.attr('from')) === _converse.bare_jid;
                return !_converse.isOnlyChatStateNotification($message) && !is_me;
            };

            _converse.playSoundNotification = function ($message) {
                /* Plays a sound to notify that a new message was recieved.
                 */
                // XXX Eventually this can be refactored to use Notification's sound
                // feature, but no browser currently supports it.
                // https://developer.mozilla.org/en-US/docs/Web/API/notification/sound
                var audio;
                if (_converse.play_sounds && typeof Audio !== "undefined") {
                    audio = new Audio(_converse.sounds_path+"msg_received.ogg");
                    if (audio.canPlayType('/audio/ogg')) {
                        audio.play();
                    } else {
                        audio = new Audio(_converse.sounds_path+"msg_received.mp3");
                        audio.play();
                    }
                }
            };

            _converse.areDesktopNotificationsEnabled = function (ignore_hidden) {
                var enabled = _converse.supports_html5_notification &&
                    _converse.show_desktop_notifications &&
                    Notification.permission === "granted";
                if (ignore_hidden) {
                    return enabled;
                } else {
                    return enabled && _converse.windowState === 'hidden';
                }
            };

            _converse.showMessageNotification = function ($message) {
                /* Shows an HTML5 Notification to indicate that a new chat
                 * message was received.
                 */
                var n, title, contact_jid, roster_item,
                    from_jid = $message.attr('from');
                if ($message.attr('type') === 'headline' || from_jid.indexOf('@') === -1) {
                    // XXX: 2nd check is workaround for Prosody which doesn't
                    // give type "headline"
                    title = __(___("Notification from %1$s"), from_jid);
                } else {
                    if ($message.attr('type') === 'groupchat') {
                        title = __(___("%1$s says"), Strophe.getResourceFromJid(from_jid));
                    } else {
                        if (typeof _converse.roster === 'undefined') {
                            _converse.log("Could not send notification, because roster is undefined", "error");
                            return;
                        }
                        contact_jid = Strophe.getBareJidFromJid($message.attr('from'));
                        roster_item = _converse.roster.get(contact_jid);
                        title = __(___("%1$s says"), roster_item.get('fullname'));
                    }
                }
                n = new Notification(title, {
                        body: $message.children('body').text(),
                        lang: _converse.i18n.locale_data.converse[""].lang,
                        icon: _converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            _converse.showChatStateNotification = function (contact) {
                /* Creates an HTML5 Notification to inform of a change in a
                 * contact's chat state.
                 */
                if (_.contains(_converse.chatstate_notification_blacklist, contact.jid)) {
                    // Don't notify if the user is being ignored.
                    return;
                }
                var chat_state = contact.chat_status,
                    message = null;
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
                var n = new Notification(contact.fullname, {
                        body: message,
                        lang: _converse.i18n.locale_data._converse[""].lang,
                        icon: 'logo/conversejs.png'
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            _converse.showContactRequestNotification = function (contact) {
                var n = new Notification(contact.fullname, {
                        body: __('wants to be your contact'),
                        lang: _converse.i18n.locale_data._converse[""].lang,
                        icon: 'logo/conversejs.png'
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            _converse.showFeedbackNotification = function (data) {
                if (data.klass === 'error' || data.klass === 'warn') {
                    var n = new Notification(data.subject, {
                            body: data.message,
                            lang: _converse.i18n.locale_data._converse[""].lang,
                            icon: 'logo/conversejs.png'
                        });
                    setTimeout(n.close.bind(n), 5000);
                }
            };

            _converse.handleChatStateNotification = function (contact) {
                /* Event handler for on('contactStatusChanged').
                 * Will show an HTML5 notification to indicate that the chat
                 * status has changed.
                 */
                if (_converse.areDesktopNotificationsEnabled()) {
                    _converse.showChatStateNotification(contact);
                }
            };

            _converse.handleMessageNotification = function (message) {
                /* Event handler for the on('message') event. Will call methods
                 * to play sounds and show HTML5 notifications.
                 */
                var $message = $(message);
                if (!_converse.shouldNotifyOfMessage(message)) {
                    return false;
                }
                _converse.playSoundNotification($message);
                if (_converse.areDesktopNotificationsEnabled()) {
                    _converse.showMessageNotification($message);
                }
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
                    ! _.contains(['denied', 'granted'], Notification.permission)) {
                    // Ask user to enable HTML5 notifications
                    Notification.requestPermission();
                }
            };

            _converse.on('pluginsInitialized', function () {
                // We only register event handlers after all plugins are
                // registered, because other plugins might override some of our
                // handlers.
                _converse.on('contactRequest',  _converse.handleContactRequestNotification);
                _converse.on('contactStatusChanged',  _converse.handleChatStateNotification);
                _converse.on('message',  _converse.handleMessageNotification);
                _converse.on('feedback', _converse.handleFeedback);
                _converse.on('connected', _converse.requestPermission);
            });
        }
    });
}));
