// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define("converse-notification", ["converse-core", "converse-api"], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        utils = converse_api.env.utils,
        Strophe = converse_api.env.Strophe,
        _ = converse_api.env._;
    // For translations
    var __ = utils.__.bind(converse);
    var ___ = utils.___;

    var supports_html5_notification = "Notification" in window;


    converse_api.plugins.add('notification', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;

            this.updateSettings({
                show_desktop_notifications: true,
                chatstate_notification_blacklist: [],
                // ^ a list of JIDs to ignore concerning chat state notifications
                play_sounds: false,
                sounds_path: '/sounds/',
                notification_icon: '/logo/conversejs.png'
            });

            converse.isOnlyChatStateNotification = function ($msg) {
                // See XEP-0085 Chat State Notification
                return (
                    $msg.find('body').length === 0 && (
                        $msg.find(converse.ACTIVE).length !== 0 ||
                        $msg.find(converse.COMPOSING).length !== 0 ||
                        $msg.find(converse.INACTIVE).length !== 0 ||
                        $msg.find(converse.PAUSED).length !== 0 ||
                        $msg.find(converse.GONE).length !== 0
                    )
                );
            };

            converse.shouldNotifyOfGroupMessage = function ($message) {
                /* Is this a group message worthy of notification?
                 */
                var jid = $message.attr('from'),
                    resource = Strophe.getResourceFromJid(jid),
                    sender = resource && Strophe.unescapeNode(resource) || '';
                if (sender === '' || $message.find('delay').length > 0) {
                    return false;
                }
                var room = converse.chatboxes.get(Strophe.getBareJidFromJid(jid));
                var body = $message.children('body').text();
                if (sender === room.get('nick') || !(new RegExp("\\b"+room.get('nick')+"\\b")).test(body)) {
                    return false;
                }
                return true;
            };

            converse.shouldNotifyOfMessage = function (message) {
                /* Is this a message worthy of notification?
                 */
                var $message = $(message),
                    $forwarded = $message.find('forwarded');
                if ($forwarded.length) {
                    return false;
                } else if ($message.attr('type') === 'groupchat') {
                    return converse.shouldNotifyOfGroupMessage($message);
                } else if (utils.isHeadlineMessage(message)) {
                    // We want to show notifications for headline messages.
                    return true;
                }
                var is_me = Strophe.getBareJidFromJid($message.attr('from')) === converse.bare_jid;
                return !converse.isOnlyChatStateNotification($message) && !is_me;
            };

            converse.playSoundNotification = function ($message) {
                /* Plays a sound to notify that a new message was recieved.
                 */
                // XXX Eventually this can be refactored to use Notification's sound
                // feature, but no browser currently supports it.
                // https://developer.mozilla.org/en-US/docs/Web/API/notification/sound
                var audio;
                if (converse.play_sounds && typeof Audio !== "undefined") {
                    audio = new Audio(converse.sounds_path+"msg_received.ogg");
                    if (audio.canPlayType('/audio/ogg')) {
                        audio.play();
                    } else {
                        audio = new Audio(converse.sounds_path+"msg_received.mp3");
                        audio.play();
                    }
                }
            };

            converse.areDesktopNotificationsEnabled = function (ignore_blur) {
                var enabled = supports_html5_notification &&
                    converse.show_desktop_notifications &&
                    Notification.permission === "granted";
                if (ignore_blur) {
                    return enabled;
                } else {
                    return enabled && converse.windowState === 'blur';
                }
            };

            converse.showMessageNotification = function ($message) {
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
                        if (typeof converse.roster === 'undefined') {
                            converse.log("Could not send notification, because roster is undefined", "error");
                            return;
                        }
                        contact_jid = Strophe.getBareJidFromJid($message.attr('from'));
                        roster_item = converse.roster.get(contact_jid);
                        title = __(___("%1$s says"), roster_item.get('fullname'));
                    }
                }
                n = new Notification(title, {
                        body: $message.children('body').text(),
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.showChatStateNotification = function (contact) {
                /* Creates an HTML5 Notification to inform of a change in a
                 * contact's chat state.
                 */
                if (_.contains(converse.chatstate_notification_blacklist, contact.jid)) {
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
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: 'logo/conversejs.png'
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.showContactRequestNotification = function (contact) {
                var n = new Notification(contact.fullname, {
                        body: __('wants to be your contact'),
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: 'logo/conversejs.png'
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.showErrorNotification = function (data) {
                var n = new Notification(__('An error has occured'), {
                        body: data.message,
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: 'logo/conversejs.png'
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.handleChatStateNotification = function (evt, contact) {
                /* Event handler for on('contactStatusChanged').
                 * Will show an HTML5 notification to indicate that the chat
                 * status has changed.
                 */
                if (converse.areDesktopNotificationsEnabled()) {
                    converse.showChatStateNotification(contact);
                }
            };

            converse.handleMessageNotification = function (evt, message) {
                /* Event handler for the on('message') event. Will call methods
                 * to play sounds and show HTML5 notifications.
                 */
                var $message = $(message);
                if (!converse.shouldNotifyOfMessage(message)) {
                    return false;
                }
                converse.playSoundNotification($message);
                if (converse.areDesktopNotificationsEnabled()) {
                    converse.showMessageNotification($message);
                }
            };

            converse.handleContactRequestNotification = function (evt, contact) {
                if (converse.areDesktopNotificationsEnabled(true)) {
                    converse.showContactRequestNotification(contact);
                }
            };

            converse.handleFeedback = function (evt, data) {
                if (data.klass === 'error' && converse.areDesktopNotificationsEnabled(true)) {
                    converse.showErrorNotification(data);
                }
            };

            converse.requestPermission = function (evt) {
                if (supports_html5_notification &&
                    ! _.contains(['denied', 'granted'], Notification.permission)) {
                    // Ask user to enable HTML5 notifications
                    Notification.requestPermission();
                }
            };

            converse.on('contactRequest',  converse.handleContactRequestNotification);
            converse.on('contactStatusChanged',  converse.handleChatStateNotification);
            converse.on('message',  converse.handleMessageNotification);
            converse.on('feedback', converse.handleFeedback);
            converse.on('connected', converse.requestPermission);
        }
    });
}));
