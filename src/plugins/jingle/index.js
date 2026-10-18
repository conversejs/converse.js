/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, converse } from '@converse/headless';
import { getCallButton } from './utils.js';
import './calls.js';
import './call.js';

converse.plugins.add('converse-jingle-views', {
    dependencies: ['converse-chatview'],

    initialize() {
        api.settings.extend({
            // Show the audio call button in 1:1 chat toolbars.
            visible_toolbar_buttons: { call: true },
        });

        api.listen.on('getToolbarButtons', getCallButton);
    },
});
