/**
 * @description Converse.js (A browser based XMPP chat client)
 * @copyright 2020, The Converse developers
 * @license Mozilla Public License (MPLv2)
 */

import _ from './lodash.noconflict';

import "@converse/headless/headless";
import "i18n";
import "shared/registry.js";

/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */
import "./plugins/autocomplete.js";
import "./plugins/bookmark-views.js";  // Views for XEP-0048 Bookmarks
import "./plugins/chatview.js";        // Renders standalone chat boxes for single user chat
import "./plugins/controlbox.js";      // The control box
import "./plugins/dragresize.js";      // Allows chat boxes to be resized by dragging them
import "./plugins/fullscreen.js";
import "./plugins/mam-views.js";
import "./plugins/minimize.js";        // Allows chat boxes to be minimized
import "./plugins/muc-views.js";       // Views related to MUC
import "./plugins/headlines-view.js";
import "./plugins/notifications.js";   // HTML5 Notifications
import "./plugins/omemo.js";
import "./plugins/profile.js";
import "./plugins/push.js";            // XEP-0357 Push Notifications
import "./plugins/register.js";        // XEP-0077 In-band registration
import "./plugins/roomslist.js";       // Show currently open chat rooms
import "./plugins/rosterview.js";
import "./plugins/singleton.js";
/* END: Removable components */

import "./components/converse.js";
import "../sass/converse.scss";

import { converse } from "@converse/headless/core";

const WHITELISTED_PLUGINS = [
    'converse-autocomplete',
    'converse-bookmark-views',
    'converse-chatboxviews',
    'converse-chatview',
    'converse-controlbox',
    'converse-dragresize',
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
    'converse-singleton'
];

// Use Mustache style syntax for variable interpolation
/* Configuration of Lodash templates (this config is distinct to the
 * config of requirejs-tpl in main.js). This one is for normal inline templates.
 */
_.templateSettings = {
    'escape': /\{\{\{([\s\S]+?)\}\}\}/g,
    'evaluate': /\{\[([\s\S]+?)\]\}/g,
    'interpolate': /\{\{([\s\S]+?)\}\}/g,
    'imports': { '_': _ }
};

converse.env._ = _;


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
