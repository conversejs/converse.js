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
        "converse-chatboxes",   // Backbone Collection and Models for chat boxes
        "converse-disco",       // Service discovery plugin
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-vcard",       // XEP-0054 VCard-temp
        /* END: Removable components */
    ], function(converse) {
        return converse;
    });
}
