/**
 * @description Converse.js (A browser based XMPP chat client)
 * @copyright 2020, The Converse developers
 * @license Mozilla Public License (MPLv2)
 */

import "@converse/headless/headless";
import "i18n";
import "shared/registry.js";

/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */
import "./plugins/bookmark-views/index.js";       // Views for XEP-0048 Bookmarks
import "./plugins/chatview/index.js";       // Renders standalone chat boxes for single user chat
import "./plugins/controlbox/index.js";     // The control box
import "./plugins/dragresize/index.js";     // Allows chat boxes to be resized by dragging them
import "./plugins/fullscreen.js";
import "./plugins/headlines-view/index.js";
import "./plugins/mam-views.js";
import "./plugins/minimize/index.js";             // Allows chat boxes to be minimized
import "./plugins/muc-views/index.js";      // Views related to MUC
import "./plugins/notifications/index.js";
import "./plugins/omemo.js";
import "./plugins/profile/index.js";
import "./plugins/push.js";                 // XEP-0357 Push Notifications
import "./plugins/register/index.js";       // XEP-0077 In-band registration
import "./plugins/roomslist/index.js";      // Show currently open chat rooms
import "./plugins/rootview/index.js";
import "./plugins/rosterview/index.js";
import "./plugins/singleton.js";
/* END: Removable components */

import "./components/converse.js";
import "../sass/converse.scss";

import { converse } from "@converse/headless/core";

const WHITELISTED_PLUGINS = [
    'converse-bookmark-views',
    'converse-chatboxviews',
    'converse-chatview',
    'converse-controlbox',
    'converse-dragresize',
    'converse-fullscreen',
    'converse-headlines-view',
    'converse-mam-views',
    'converse-minimize',
    'converse-modal',
    'converse-muc-views',
    'converse-notification',
    'converse-omemo',
    'converse-profile',
    'converse-push',
    'converse-register',
    'converse-roomslist',
    'converse-rootview',
    'converse-rosterview',
    'converse-singleton'
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
