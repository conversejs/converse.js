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

    if (supports_html5_notification && Notification.permission !== 'denied') {
        // Ask user to enable HTML5 notifications
        Notification.requestPermission();
    }

    converse_api.plugins.add('notification', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            // Configuration values for this plugin
            var settings = {
                show_desktop_notifications: true,
                play_sounds: false,
                sounds_path: '/sounds/',
                notification_icon: '/logo/conversejs.png'
            };
            _.extend(converse.default_settings, settings);
            _.extend(converse, settings);
            _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));

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

            converse.shouldNotifyOfNewMessage = function ($message) {
                var $forwarded = $message.find('forwarded');
                if ($forwarded.length) {
                    return false;
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

            converse.showMessageNotification = function ($message) {
                /* Shows an HTML5 Notification to indicate that a new chat
                 * message was received.
                 */
                if (!supports_html5_notification ||
                        !converse.show_desktop_notifications ||
                        converse.windowState !== 'blur' ||
                        Notification.permission !== "granted") {
                    return;
                }
                var contact_jid = Strophe.getBareJidFromJid($message.attr('from'));
                var roster_item = converse.roster.get(contact_jid);
                var n = new Notification(__(___("%1$s says"), roster_item.get('fullname')), {
                        body: $message.children('body').text(),
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.handleChatStateNotification = function (evt, contact) {
                /* Event handler for on('contactStatusChanged').
                 * Will show an HTML5 notification to indicate that the chat
                 * status has changed.
                 */
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


            converse.handleNewMessageNotification = function (evt, message) {
                /* Event handler for the on('message') event. Will call methods
                 * to play sounds and show HTML5 notifications.
                 */
                var $message = $(message);
                if (!converse.shouldNotifyOfNewMessage($message)) {
                    return false;
                }
                converse.playSoundNotification($message);
                converse.showMessageNotification($message);
            };

            converse.on('contactStatusChanged',  converse.handleChatStateNotification);
            converse.on('message',  converse.handleNewMessageNotification);
        }
    });
}));
