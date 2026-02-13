/**
 * @description Converse.js (A browser based XMPP chat client)
 * @copyright 2025, The Converse developers
 * @license Mozilla Public License (MPLv2)
 */
import 'shared/styles/index.scss';

import { i18n } from "i18n/index.js";
import "shared/registry.js";
import 'shared/components/index.js';
import { CustomElement } from 'shared/components/element';
import { VIEW_PLUGINS } from './shared/constants.js';
import { _converse, converse } from "@converse/headless";
import "./utils/index.js";
import { routeToQueryAction } from './plugins/chatview/utils.js';

_converse.__ = i18n.__; // DEPRECATED
Object.assign(converse.env, { i18n });
Object.assign(_converse.env, { i18n });

/* START: Removable plugins
 * ------------------------
 * Any of the following plugin imports may be removed if the plugin is not needed
 */
import "./plugins/modal/index.js";
import "./plugins/adhoc-views/index.js";    // Views for XEP-0050 Ad-Hoc commands
import "./plugins/bookmark-views/index.js"; // Views for XEP-0048 Bookmarks
import "./plugins/chatview/index.js";       // Renders standalone chat boxes for single user chat
import "./plugins/controlbox/index.js";     // The control box
import "./plugins/disco-views/index.js";    // Adds a service discovery browser component
import "./plugins/headlines-view/index.js";
import "./plugins/mam-views/index.js";
import "./plugins/minimize/index.js";       // Allows chat boxes to be minimized
import "./plugins/muc-views/index.js";      // Views related to MUC
import "./plugins/notifications/index.js";
import "./plugins/profile/index.js";
import "./plugins/omemo-views/index.js";
import "./plugins/push/index.js";           // XEP-0357 Push Notifications
import "./plugins/register/index.js";       // XEP-0077 In-band registration
import "./plugins/roomslist/index.js";      // Show currently open chat rooms
import "./plugins/rootview/index.js";
import "./plugins/rosterview/index.js";
import "./plugins/singleton/index.js";
import "./plugins/dragresize/index.js";     // Allows chat boxes to be resized by dragging them
import "./plugins/fullscreen/index.js";
/* END: Removable components */

_converse.exports.CustomElement = CustomElement;

// Register XMPP protocol handler for xmpp: URIs
if ('registerProtocolHandler' in navigator) {
    try {
        const handlerUrl = `${window.location.origin}${window.location.pathname}#converse/action?uri=%s`;
        navigator.registerProtocolHandler('xmpp', handlerUrl);
    } catch (error) {
        console.warn('Failed to register protocol handler:', error);
    }
}

const initialize = converse.initialize;

converse.initialize = function (settings, callback) {
    if (Array.isArray(settings.whitelisted_plugins)) {
        settings.whitelisted_plugins = settings.whitelisted_plugins.concat(VIEW_PLUGINS);
    } else {
        settings.whitelisted_plugins = VIEW_PLUGINS;
    }
    
    // Handle XEP-0147 query actions after initialization
    // This must happen after plugins are loaded and _converse.env is ready
    const result = initialize(settings, callback);
    if (result && result.then) {
        result.then(() => routeToQueryAction()).catch(err => console.error('Failed to route query action:', err));
    }
    return result;
}

export default converse;
