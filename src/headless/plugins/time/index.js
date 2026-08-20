/**
 * @description
 * Converse.js plugin which adds support for XEP-0202 Entity Time.
 * @see https://xmpp.org/extensions/xep-0202.html
 * @copyright 2026, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import time_api from './api.js';
import { onChatBoxInitialized } from './entity-time.js';
import { addClientFeatures, registerTimeHandler } from './utils.js';

converse.plugins.add('converse-time', {
    dependencies: ['converse-disco'],

    initialize() {
        api.settings.extend({
            // Who we answer time requests from: 'public' for anyone,
            // 'presence' for entities subscribed to our presence, and anything
            // falsy for nobody.
            'send_entity_time': 'presence',
            'show_entity_time': true,
            'entity_time_warning_start': 22,
            'entity_time_warning_end': 7,
            'entity_time_min_diff_hours': 0, // Minimum timezone difference to show warning (0 = any different timezone)
        });

        Object.assign(api, time_api);

        api.listen.on('addClientFeatures', addClientFeatures);
        api.listen.on('connected', registerTimeHandler);
        api.listen.on('reconnected', registerTimeHandler);
        api.listen.on('chatBoxInitialized', onChatBoxInitialized);
    },
});
