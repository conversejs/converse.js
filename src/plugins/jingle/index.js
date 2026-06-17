/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, converse } from '@converse/headless';
import { writeCallHistory } from './utils.js';
import './calls.js';
import './call.js';

converse.plugins.add('converse-jingle-views', {
    dependencies: ['converse-chatview'],

    initialize() {
        api.settings.extend({
            // Show the core toolbar phone button (off by default in chatview).
            visible_toolbar_buttons: { call: true },
        });

        // The toolbar phone button: dial the open 1:1 chat's contact.
        api.listen.on('callButtonClicked', ({ model }) => {
            if (model.get('type') === 'groupchat') return;
            api.calls.dial(model.get('jid'), { audio: true });
        });

        // Leave a history row in the chat once the call is over.
        api.listen.on('callEnded', (call) => writeCallHistory(call));
    },
});
