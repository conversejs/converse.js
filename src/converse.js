/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */

import "@converse/headless/converse-caps";            // XEP-0115 Entity Capabilities
import "@converse/headless/converse-mam";             // XEP-0313 Message Archive Management
import "@converse/headless/converse-ping";            // XEP-0199 XMPP Ping
import "@converse/headless/converse-pubsub";          // XEP-0060 PubSub
import "@converse/headless/converse-vcard";           // XEP-0054 VCard-temp
import "converse-autocomplete";
import "converse-bookmarks";       // XEP-0048 Bookmarks
import "converse-chatview";        // Renders standalone chat boxes for single user chat
import "converse-controlbox";      // The control box
import "converse-dragresize";      // Allows chat boxes to be resized by dragging them
import "converse-embedded";
import "converse-fullscreen";
import "converse-headline";        // Support for headline messages
import "converse-mam-views";
import "converse-minimize";        // Allows chat boxes to be minimized
import "converse-muc-views";       // Views related to MUC
import "converse-notification";    // HTML5 Notifications
import "converse-omemo";
import "converse-push";            // XEP-0357 Push Notifications
import "converse-register";        // XEP-0077 In-band registration
import "converse-roomslist";       // Show currently open chat rooms
import "converse-rosterview";
/* END: Removable components */

import converse from "@converse/headless/converse-core";

const WHITELISTED_PLUGINS = [
    'converse-autocomplete',
    'converse-bookmarks',
    'converse-chatboxviews',
    'converse-chatview',
    'converse-controlbox',
    'converse-dragresize',
    'converse-embedded',
    'converse-fullscreen',
    'converse-headline',
    'converse-mam-views',
    'converse-message-view',
    'converse-minimize',
    'converse-modal',
    'converse-muc-views',
    'converse-notification',
    'converse-omemo',
    'converse-profile',
    'converse-push',
    'converse-register',
    'converse-roomslist',
    'converse-rosterview',
    'converse-singleton'
];

const initialize = converse.initialize;

converse.initialize = function (settings, callback) {
    if (converse.env._.isArray(settings.whitelisted_plugins)) {
        settings.whitelisted_plugins = settings.whitelisted_plugins.concat(WHITELISTED_PLUGINS);
    } else {
        settings.whitelisted_plugins = WHITELISTED_PLUGINS;
    }
    return initialize(settings, callback);
}

export default converse;
