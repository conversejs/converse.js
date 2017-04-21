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
        "converse-bookmarks",   // XEP-0048 Bookmarks
        "converse-chatview",    // Renders standalone chat boxes for single user chat
        "converse-controlbox",  // The control box
        "converse-headline",    // Support for headline messages
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-notification",// HTML5 Notifications
        "converse-otr",         // Off-the-record encryption for one-on-one messages
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-register",    // XEP-0077 In-band registration
        "converse-singleton",   // Allow at most a single chat to be visible at any one time
        "converse-vcard",       // XEP-0054 VCard-temp
        /* END: Removable components */
    ], function (converse) {
        return converse;
    });
}
