/**
 * @description
 *  Converse.js plugin which shows a list of currently open
 *  rooms in the "Rooms Panel" of the ControlBox.
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/plugins/muc/index.js";
import './view.js';
import { _converse, api, converse } from "@converse/headless/core";


converse.plugins.add('converse-roomslist', {

    dependencies: ["converse-singleton", "converse-controlbox", "converse-muc", "converse-bookmarks"],

    initialize () {
        // Event handlers
        api.listen.on('connected', async () =>  {
            if (_converse.allow_bookmarks) {
                await api.waitUntil('bookmarksInitialized');
            } else {
                await Promise.all([
                    api.waitUntil('chatBoxesFetched'),
                ]);
            }
        });
    }
});
