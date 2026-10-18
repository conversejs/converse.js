/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse } from '@converse/headless';
import { getCallButton } from './utils.js';
import { updateTone } from './tones.js';
import './calls.js';
import './call.js';

converse.plugins.add('converse-jingle-views', {
    dependencies: ['converse-chatview', 'converse-jingle'],

    initialize() {
        api.settings.extend({
            // Show the audio call button in 1:1 chat toolbars.
            visible_toolbar_buttons: { call: true },
        });

        api.listen.on('getToolbarButtons', getCallButton);

        // Ring while a call rings, on either side.
        api.listen.on('callsInitialized', () => {
            _converse.state.calls.on('add remove reset change:state', updateTone);
        });
    },
});
