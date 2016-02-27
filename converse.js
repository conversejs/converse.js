/* Converse.js components configuration
 *
 * This file is used to tell require.js which components (or plugins) to load
 * when it generates a build.
 */
define("converse", ["converse-api",

    /* START: Removable components
     * --------------------
     * Any of the following components may be removed if they're not needed.
     */
    "locales",          // Translations for converse.js. This line can be removed
                        // to remove *all* translations, or you can modify the
                        // file src/locales.js to include only those
                        // translations that you care about.

    "converse-muc",     // XEP-0045 Multi-user chat
    "converse-otr",     // Off-the-record encryption for one-on-one messages
    "converse-register",// XEP-0077 In-band registration
    "converse-ping",    // XEP-0199 XMPP Ping
    /* END: Removable components */

], function(converse_api) {
    window.converse = converse_api;
    return converse_api;
});
