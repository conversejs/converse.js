/* Converse.js build configuration
 *
 * This file is used to tell require.js which components (or plugins) to load
 * when it generates a build.
 */
define("converse", [
    /* Removable components
     * --------------------
     * Any of the following components can be removed if they're not needed.
     */
    "converse-muc", // XEP-0045 Multi-user chat
    /* End: Removable components */

    "converse-core"
], function() {
    return arguments[arguments.length-1];
});
