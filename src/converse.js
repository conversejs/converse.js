/**
 * @description Converse.js (A browser based XMPP chat client)
 * @copyright 2020, The Converse developers
 * @license Mozilla Public License (MPLv2)
 */

import _ from './lodash.noconflict';

/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */
import "@converse/headless/headless";
import "i18n";
import "converse-registry";
import "converse-autocomplete";
import "converse-bookmark-views";  // Views for XEP-0048 Bookmarks
import "converse-chatview";        // Renders standalone chat boxes for single user chat
import "converse-controlbox";      // The control box
import "converse-dragresize";      // Allows chat boxes to be resized by dragging them
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
import "./components/converse.js";
/* END: Removable components */

import "../sass/converse.scss";

import { converse } from "@converse/headless/converse-core";

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
