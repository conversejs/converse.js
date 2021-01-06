/**
 * @description
 *  Converse.js plugin which shows a list of currently open
 *  rooms in the "Rooms Panel" of the ControlBox.
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/plugins/muc/index.js";
import './view.js';
import RoomsList from './model.js';
import { _converse, api, converse } from "@converse/headless/core";


converse.plugins.add('converse-roomslist', {
    /* Dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are called "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * It's possible however to make optional dependencies non-optional.
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ["converse-singleton", "converse-controlbox", "converse-muc", "converse-bookmarks"],

    initialize () {
        _converse.RoomsList= RoomsList;

        // Event handlers
        api.listen.on('connected', async () =>  {
            if (_converse.allow_bookmarks) {
                await api.waitUntil('bookmarksInitialized');
            } else {
                await Promise.all([
                    api.waitUntil('chatBoxesFetched'),
                    api.waitUntil('roomsPanelRendered')
                ]);
            }
        });
    }
});
