/**
 * @module converse-fullscreen
 * @license Mozilla Public License (MPLv2)
 * @copyright 2020, the Converse.js contributors
 */
import "./chatview.js";
import "./controlbox/index.js";
import "./singleton.js";
import "@converse/headless/plugins/muc";
import { api, converse } from "@converse/headless/core";


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
