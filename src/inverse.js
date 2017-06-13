/* Converse.js components configuration
 *
 * This file is used to tell require.js which components (or plugins) to load
 * when it generates a build.
 */
if (typeof define !== 'undefined') {
    /* When running tests, define is not defined. */
    define("inverse", [
        "converse-core",
        /* START: Removable components
        * --------------------
        * Any of the following components may be removed if they're not needed.
        */
        "converse-chatview",    // Renders standalone chat boxes for single user chat
        "converse-controlbox",  // The control box
        "converse-bookmarks",   // XEP-0048 Bookmarks
        "converse-roomslist",   // Show currently open chat rooms
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-vcard",       // XEP-0054 VCard-temp
        "converse-otr",         // Off-the-record encryption for one-on-one messages
        "converse-register",    // XEP-0077 In-band registration
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-notification",// HTML5 Notifications
        "converse-headline",    // Support for headline messages

        "converse-inverse",     // Inverse plugin for converse.js
        /* END: Removable components */

    ], function(converse) {
        var $ = converse.env.jQuery;
        window.converse = converse;
        $(window).trigger('converse-loaded', converse);
        return converse;
    });
}
