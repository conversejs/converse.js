/*global define */
if (typeof define !== 'undefined') {
    // The section below determines which plugins will be included in a build
    define([
        "converse-core",
        /* START: Removable components
         * --------------------
         * Any of the following components may be removed if they're not needed.
         */
        "converse-bookmarks",       // XEP-0048 Bookmarks
        "converse-caps",
        "converse-chatview",        // Renders standalone chat boxes for single user chat
        "converse-controlbox",      // The control box
        "converse-dragresize",      // Allows chat boxes to be resized by dragging them
        "converse-embedded",
        "converse-fullscreen",
        "converse-headline",        // Support for headline messages
        "converse-mam",             // XEP-0313 Message Archive Management
        "converse-minimize",        // Allows chat boxes to be minimized
        "converse-muc",             // XEP-0045 Multi-user chat
        "converse-muc-views",
        "converse-muc-views",       // Views related to MUC
        "converse-notification",    // HTML5 Notifications
        "converse-ping",            // XEP-0199 XMPP Ping
        "converse-roster",
        "converse-register",        // XEP-0077 In-band registration
        "converse-roomslist",       // Show currently open chat rooms
        "converse-vcard",           // XEP-0054 VCard-temp
        /* END: Removable components */
    ], function (converse) {
        return converse;
    });
}
