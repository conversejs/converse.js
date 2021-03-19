/**
 * @module converse-fullscreen
 * @license Mozilla Public License (MPLv2)
 * @copyright 2020, the Converse.js contributors
 */
import "plugins/chatview/index.js";
import "plugins/controlbox/index.js";
import "plugins/singleton.js";
import "@converse/headless/plugins/muc/index.js";
import { api, converse } from "@converse/headless/core";

import './styles/fullscreen.scss';
import './styles/background.scss';


converse.plugins.add('converse-fullscreen', {

    enabled (_converse) {
        return _converse.isUniView();
    },

    initialize () {
        api.settings.extend({
            chatview_avatar_height: 50,
            chatview_avatar_width: 50,
            hide_open_bookmarks: true,
            show_controlbox_by_default: true,
            sticky_controlbox: true
        });
    }
});
