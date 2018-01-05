/* Inverse.js components configuration
 *
 * This file is used to tell require.js which components (or plugins) to load
 * when it generates a build of inverse.js (in dist/inverse.js)
 */
if (typeof define !== 'undefined') {
    // The section below determines which plugins will be included in a build
    define([
        "converse-core",
        /* START: Removable components
         * --------------------
         * Any of the following components may be removed if they're not needed.
         */
        "converse-bookmarks",   // XEP-0048 Bookmarks
        "converse-chatboxes",   // Backbone Collection and Models for chat boxes
        "converse-chatview",    // Renders standalone chat boxes for single user chat
        "converse-controlbox",  // The control box
        "converse-disco",       // Service discovery plugin
        "converse-headline",    // Support for headline messages
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-notification",// HTML5 Notifications
        "converse-otr",         // Off-the-record encryption for one-on-one messages
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-register",    // XEP-0077 In-band registration
        "converse-roomslist",   // Show currently open chat rooms
        "converse-vcard",       // XEP-0054 VCard-temp
        /* END: Removable components */

        "converse-inverse",     // Inverse plugin for converse.js
    ], function(converse) {
        return converse;
    });
}
