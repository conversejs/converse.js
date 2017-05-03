/*global define */
if (typeof define !== 'undefined') {
    // The section below determines which plugins will be included in a build
    define([
        "converse-core",
        // PLEASE NOTE: By default all translations are included.
        // You can modify the file src/locales.js to include only those
        // translations that you care about.

        /* START: Removable components
         * --------------------
         * Any of the following components may be removed if they're not needed.
         */
        "converse-chatview",    // Renders standalone chat boxes for single user chat
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-muc-embedded",
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-notification",// HTML5 Notifications
        /* END: Removable components */
    ], function (converse) {
        return converse;
    });
}
