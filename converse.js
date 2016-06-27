/* Converse.js components configuration
 *
 * This file is used to tell require.js which components (or plugins) to load
 * when it generates a build.
 */

if (typeof define !== 'undefined') {
    /* When running tests, define is not defined. */
    define("converse", [
        "jquery",
        "converse-api",

        /* START: Removable components
        * --------------------
        * Any of the following components may be removed if they're not needed.
        */
        "locales",              // Translations for converse.js. This line can be removed
                                // to remove *all* translations, or you can modify the
                                // file src/locales.js to include only those
                                // translations that you care about.

        "converse-chatview",    // Renders standalone chat boxes for single user chat
        "converse-controlbox",  // The control box
        "converse-bookmarks",   // XEP-0048 Bookmarks
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-vcard",       // XEP-0054 VCard-temp
        "converse-otr",         // Off-the-record encryption for one-on-one messages
        "converse-register",    // XEP-0077 In-band registration
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-notification",// HTML5 Notifications
        "converse-minimize",    // Allows chat boxes to be minimized
        "converse-dragresize",  // Allows chat boxes to be resized by dragging them
        "converse-headline",    // Support for headline messages
        /* END: Removable components */

    ], function($, converse_api) {
        window.converse = converse_api;
        $(window).trigger('converse-loaded', converse_api);
        return converse_api;
    });
}
