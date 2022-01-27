/**
 * @description Converse.js (A browser based XMPP chat client)
 * @copyright 2021, The Converse developers
 * @license Mozilla Public License (MPLv2)
 */

import "@converse/headless/headless";
import "./i18n/index.js";
import "shared/registry.js";
import { CustomElement } from 'shared/components/element';
import { VIEW_PLUGINS } from './shared/constants.js';
import { _converse, converse } from "@converse/headless/core";

import 'shared/styles/index.scss';

/* START: Removable plugins
 * ------------------------
 * Any of the following plugin imports may be removed if the plugin is not needed
 */
import "./plugins/bookmark-views/index.js"; // Views for XEP-0048 Bookmarks
import "./plugins/chatview/index.js";       // Renders standalone chat boxes for single user chat
import "./plugins/controlbox/index.js";     // The control box
import "./plugins/dragresize/index.js";     // Allows chat boxes to be resized by dragging them
import "./plugins/fullscreen/index.js";
import "./plugins/headlines-view/index.js";
import "./plugins/mam-views/index.js";
import "./plugins/minimize/index.js";       // Allows chat boxes to be minimized
import "./plugins/muc-views/index.js";      // Views related to MUC
import "./plugins/notifications/index.js";
import "./plugins/omemo/index.js";
import "./plugins/profile/index.js";
import "./plugins/push/index.js";           // XEP-0357 Push Notifications
import "./plugins/register/index.js";       // XEP-0077 In-band registration
import "./plugins/roomslist/index.js";      // Show currently open chat rooms
import "./plugins/rootview/index.js";
import "./plugins/rosterview/index.js";
import "./plugins/singleton/index.js";
/* END: Removable components */


_converse.CustomElement = CustomElement;

const initialize = converse.initialize;

converse.initialize = function (settings, callback) {
    if (Array.isArray(settings.whitelisted_plugins)) {
        settings.whitelisted_plugins = settings.whitelisted_plugins.concat(VIEW_PLUGINS);
    } else {
        settings.whitelisted_plugins = VIEW_PLUGINS;
    }
    return initialize(settings, callback);
}

export default converse;
