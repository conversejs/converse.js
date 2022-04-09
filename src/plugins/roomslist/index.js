/**
 * @description
 *  Converse.js plugin which shows a list of currently open
 *  rooms in the "Rooms Panel" of the ControlBox.
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/plugins/muc/index.js";
import './view.js';
import { converse } from "@converse/headless/core";


converse.plugins.add('converse-roomslist', {

    dependencies: [
        "converse-singleton",
        "converse-controlbox",
        "converse-muc",
        "converse-bookmarks"
    ],

    initialize () { }
});
