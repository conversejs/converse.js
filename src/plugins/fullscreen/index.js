/**
 * @module converse-fullscreen
 * @license Mozilla Public License (MPLv2)
 * @copyright 2022, the Converse.js contributors
 */
import { api, converse } from "@converse/headless/core";
import { isUniView } from '@converse/headless/utils/core.js';

import './styles/fullscreen.scss';


converse.plugins.add('converse-fullscreen', {

    enabled () {
        return isUniView();
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
