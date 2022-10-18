/**
 * @description
 *  Converse.js plugin which provides the UI for XEP-0050 Ad-Hoc commands
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './adhoc-commands.js';
import { api, converse } from "@converse/headless/core.js";


converse.plugins.add('converse-adhoc-views', {

    dependencies: [
        "converse-controlbox",
        "converse-muc",
    ],

    initialize () {
        api.settings.extend({
            'allow_adhoc_commands': true,
        });
    }
});
