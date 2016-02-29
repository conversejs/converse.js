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
    var utils = converse_api.env.utils;
    var Strophe = converse_api.env.Strophe;
    // For translations
    var __ = utils.__.bind(converse);
    var ___ = utils.___;

    if (!("Notification" in window)) {
        // HTML5 notifications aren't supported.
        converse.log(
            "Not loading the notifications plugin because this browser "+
            "doesn't support HTML5 notifications.");
        return;
    }
    // Ask user to enable HTML5 notifications
    Notification.requestPermission();


    converse_api.plugins.add('notification', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            notifyOfNewMessage: function ($message) {
                var result = this._super.notifyOfNewMessage.apply(this, arguments);
                if (result && (this.windowState === 'blur') && (Notification.permission === "granted")) {
                    this.showMessageNotification($message);
                }
                return result;
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;

            converse.showChatStateNotification = function (event, contact) {
                /* Show an HTML5 notification indicating that a contact changed
                 * their chat state.
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

            converse.on('contactStatusChanged',  converse.showChatStateNotification);

            converse.showMessageNotification = function ($message) {
                /* Show an HTML5 notification of a received message.
                 */
                var contact_jid = Strophe.getBareJidFromJid($message.attr('from'));
                var roster_item = converse.roster.get(contact_jid);
                var n = new Notification(__(___("%1$s says"), roster_item.get('fullname')), {
                        body: $message.children('body').text(),
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: 'logo/conversejs.png'
                    });
                setTimeout(n.close.bind(n), 5000);
            };
        }
    });
}));
