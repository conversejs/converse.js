/**
 * @description
 *  Converse.js plugin which shows a list of currently open
 *  rooms in the "Rooms Panel" of the ControlBox.
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/plugins/muc/index.js";
import RoomsList from './model.js';
import RoomsListView from './view.js';
import { _converse, api, converse } from "@converse/headless/core";


const initRoomsListView = function () {
    _converse.rooms_list_view = new _converse.RoomsListView({'model': _converse.chatboxes});
    /**
     * Triggered once the _converse.RoomsListView has been created and initialized.
     * @event _converse#roomsListInitialized
     * @example _converse.api.listen.on('roomsListInitialized', status => { ... });
     */
    api.trigger('roomsListInitialized');
};


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
        // Promises exposed by this plugin
        api.promises.add('roomsListInitialized');

        _converse.RoomsList= RoomsList;
        _converse.RoomsListView = RoomsListView;

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
            initRoomsListView();
        });

        api.listen.on('reconnected', initRoomsListView);
    }
});
