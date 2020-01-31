/**
 * @description Converse.js (A browser based XMPP chat client)
 * @copyright 2020, The Converse developers
 * @license Mozilla Public License (MPLv2)
 */

/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */
import "@converse/headless/headless";
import "converse-autocomplete";
import "converse-bookmark-views";  // Views for XEP-0048 Bookmarks
import "converse-chatview";        // Renders standalone chat boxes for single user chat
import "converse-controlbox";      // The control box
import "converse-dragresize";      // Allows chat boxes to be resized by dragging them
import "converse-emoji-views";
import "converse-fullscreen";
import "converse-mam-views";
import "converse-minimize";        // Allows chat boxes to be minimized
import "converse-muc-views";       // Views related to MUC
import "converse-headlines-view";
import "converse-notification";    // HTML5 Notifications
import "converse-omemo";
import "converse-profile";
import "converse-push";            // XEP-0357 Push Notifications
import "converse-register";        // XEP-0077 In-band registration
import "converse-roomslist";       // Show currently open chat rooms
import "converse-rosterview";
import "converse-singleton";
import "converse-uniview";
/* END: Removable components */

import "../sass/converse.scss";

import converse from "@converse/headless/converse-core";

const WHITELISTED_PLUGINS = [
    'converse-autocomplete',
    'converse-bookmark-views',
    'converse-chatboxviews',
    'converse-chatview',
    'converse-controlbox',
    'converse-dragresize',
    'converse-emoji-views',
    'converse-fullscreen',
    'converse-mam-views',
    'converse-minimize',
    'converse-modal',
    'converse-muc-views',
    'converse-headlines-view',
    'converse-notification',
    'converse-omemo',
    'converse-profile',
    'converse-push',
    'converse-register',
    'converse-roomslist',
    'converse-rosterview',
    'converse-singleton',
    'converse-uniview'
];

const initialize = converse.initialize;

converse.initialize = function (settings, callback) {
    if (Array.isArray(settings.whitelisted_plugins)) {
        settings.whitelisted_plugins = settings.whitelisted_plugins.concat(WHITELISTED_PLUGINS);
    } else {
        settings.whitelisted_plugins = WHITELISTED_PLUGINS;
    }
    return initialize(settings, callback);
}

export default converse;
